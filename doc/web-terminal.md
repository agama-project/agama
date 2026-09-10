# The web terminal

Agama's web UI can open a real shell on the system being installed, running as root, right inside
the browser. It exists for troubleshooting, working around something the installer does not expose,
mointoring, etc.

This document explains how the feature is built, end to end: the WebSocket
protocol, the pty session on the server, and the terminal panel in the web UI.

- [Architecture](#architecture)
- [Wire protocol](#wire-protocol)
- [Backend: a shell per connection](#backend-a-shell-per-connection)
- [Frontend: the terminal panel](#frontend-the-terminal-panel)
- [Session lifecycle](#session-lifecycle)
- [No automatic reconnection](#no-automatic-reconnection)
- [Keyboard accessibility](#keyboard-accessibility)
- [Opening the terminal](#opening-the-terminal)
- [Small screens](#small-screens)
- [Appearance](#appearance)
- [Security](#security)

## Architecture

```
xterm.js  <-- keystrokes/output -->  WebSocket  <-- keystrokes/output -->  pty  <-->  bash
(browser)                        /api/terminal/ws                    (agama-server, as root)
```

- **Backend**: [`rust/agama-server/src/terminal/web.rs`](../rust/agama-server/src/terminal/web.rs)
  exposes a WebSocket at `/api/terminal/ws`. Every connection spawns a new `bash` attached to a
  pseudo-terminal (via the [`pty-process` crate](https://crates.io/crates/pty-process)) and shuttles
  bytes between the socket and the pty for as long as the connection stays open.
- **Frontend**: [`web/src/hooks/use-terminal-session.ts`](../web/src/hooks/use-terminal-session.ts)
  owns an [xterm.js](https://xtermjs.org/) instance and the WebSocket connection;
  [`TerminalPane`](../web/src/components/core/TerminalPane.tsx) and
  [`TerminalDock`](../web/src/components/core/TerminalDock.tsx) render it as a panel docked at the
  bottom of the application, and [`context/terminal.tsx`](../web/src/context/terminal.tsx) tracks
  whether it's open, minimized, and how tall.

There is **no session persistence** on the backend: closing the WebSocket (from either end) kills
the shell, and a new connection always starts an unrelated, brand new one. Nothing survives a page
reload, and the frontend never tries to reconnect a session that was lost — see [No automatic
reconnection](#no-automatic-reconnection).

## Wire protocol

The socket carries two kinds of frames:

- **Binary frames** carry raw bytes: keystrokes from the client, the shell's output from the server.
  No framing beyond that — whatever the pty writes is forwarded as-is.
- **Text frames** carry small JSON control messages.

From the client, the only supported message resizes the pty:

```json
{ "cols": 80, "rows": 24 }
```

From the server, a single message announces that the shell exited, sent right
before the socket closes gracefully:

```json
{ "type": "exit", "code": 0, "signal": null }
```

Exactly one of `code` and `signal` is set:

- **`code`** for a normal exit — any way the shell ends on its own: typing
  `exit`, `exit N`, or pressing Ctrl-D. Whatever the number, this is the shell
  ending on purpose.
- **`signal`** when the shell was instead killed by an unhandled signal — a
  crash, an out-of-memory kill, an external `kill`:

  ```json
  { "type": "exit", "code": null, "signal": 11 }
  ```

The frontend treats these two cases very differently; see [Session lifecycle](#session-lifecycle).
The same protocol is documented for external tools (e.g. testing with `websocat`) in
[`rust/WEB-SERVER.md`](../rust/WEB-SERVER.md#the-terminal-websocket).

## Backend: a shell per connection

`handle_socket` (in `terminal/web.rs`) drives one session for the lifetime of one WebSocket, as a
`tokio::select!` loop over three things at once:

1. **Messages from the browser**: binary frames are written to the pty; text frames are parsed as a
   resize request (anything else is logged and ignored, not fatal); the client closing the socket
   ends the loop.
2. **Output from the shell**: read from the pty master and forwarded as binary frames.
3. **The shell process itself** (`child.wait()`): once it exits, the server builds the
   `code`/`signal` pair from `std::os::unix::process::ExitStatusExt`, sends the exit message, then
   closes the socket gracefully.

The child is spawned with:

- shell: always `bash` (no user-configurable alternative);
- `TERM=xterm-256color`, plus whatever else the server process's own environment provides;
- working directory: `$HOME` of the user running the server (root, in practice but falls back to the
  server's own working directory if unset);
- pty size: 80×24 until the client sends its first resize message.

Whatever ends the loop (the client disconnecting, a read/write error, or the shell exiting on its
own) the code always falls through to killing and reaping the child afterwards, so a dropped
connection never leaves an orphaned shell running.

### The `EIO` quirk

On Linux, reading a pty master returns `EIO` (errno 5) once the pty's slave side has closed (which
is what happens when the shell exists) instead of a clean end-of-file like a pipe would. The read
loop treats `EIO` the same as a clean EOF: it stops polling that stream (rather than treating it as
a hard error) and lets the `child.wait()` branch report the actual exit and close the socket
gracefully. Getting this wrong once meant the exit message and the graceful close were skipped
entirely, and the connection was simply dropped, making it impossible for the client to distinguish
a clean exit from a network failure.

## Frontend: the terminal panel

Three layers, each with one job:

- **`context/terminal.tsx`** is just state: `isOpen`, `isMinimized`, the preferred `height`, and the
  actions that change them (`open`, `close`, `toggle`, `minimize`, `restore`, `setHeight`). It lives
  above the page-swapping route outlet (mounted once, high in the app), so it survives navigating
  between installer pages.
- **`TerminalDock`** is the app-shell layout: it docks the panel below the application, with a
  draggable divider ([`ResizeHandle`](../web/src/components/core/ResizeHandle.tsx)) to share the
  height. It also decides whether there's `enoughSpace` for a usable terminal (at least 1024×768 for
  the whole dock, tracked live with a `ResizeObserver`) and passes that down to `TerminalPane`.
- **`TerminalPane`** is the actual panel: header, toolbar (font size, clear), the minimize/close
  actions, and — when there's enough space — a container `<div>` that `useTerminalSession` attaches
  xterm.js to. When minimized, that container stays mounted (just hidden with CSS), so the session
  and its scrollback are kept.

`useTerminalSession(container, options)` is where the actual xterm.js instance and the WebSocket
connection live, for as long as `TerminalPane` (its caller) stays mounted (only while the terminal
is open). `container` may start out `null` (while the panel shows its "not enough room" message) and
change identity later, whenever `TerminalDock` unmounts and remounts it. The hook re-attaches
xterm.js's existing element to whatever container is current rather than recreating anything.

xterm.js's own `open()` does not help with that re-attachment: it only moves a terminal to a
different _browser window_, and is a no-op if called again on one already open in the same window.
The hook instead moves the existing `terminal.element` into the new container by hand
(`container.appendChild(terminal.element)`) whenever its parent no longer matches, and refocuses it.

## Session lifecycle

A session, once started, ends in exactly one of four ways:

| How it ends                                              | Client sees                  | What happens to the panel                    |
| -------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| Shell exits normally (`exit`, `exit N`, Ctrl-D)          | exit message, `signal: null` | **Closes automatically**                     |
| Shell killed by a signal (crash, OOM, external `kill`)   | exit message, `signal: <N>`  | Stays open, shows `[terminated by signal N]` |
| Connection drops unexpectedly (network, backend restart) | socket just closes           | Stays open, shows `[connection lost]`        |
| User clicks "Close terminal"                             | —                            | Closes (this is what ends the WebSocket)     |

The panel auto-closing on a normal exit matches how every other terminal emulator behaves: typing
`exit` closes the window. It happens whatever the exit code, deliberately. Plain `exit` in bash
exits with the status of the _last command run_, which says nothing about whether the user actually
meant to leave, so keying the auto-close off the code would be unreliable.

A signal-based kill or a dropped connection get the _same_ treatment as each
other (left open, with a message) because both are unexpected: the user did
not ask for the session to end, so the panel says why and waits for them to
act, rather than silently doing something on their behalf.

## Keyboard accessibility

A terminal has to take over almost every key, Tab included (shells use it to complete words). Left
as-is, that is a keyboard trap: once focused, someone not using a pointer has no way back to the
rest of the interface, which WCAG forbids ([SC 2.1.2, "No Keyboard
Trap"](https://www.w3.org/WAI/WCAG21/Understanding/no-keyboard-trap.html)).

The way out is **Escape, then Tab**, which is the same sequence embedded code editors use for this
(Monaco, CodeMirror, Ace). Escape still reaches the shell as usual; only a Tab typed right _after_
an Escape is intercepted, moving the focus to the panel around the terminal instead. That sequence
cannot be guessed, so `TerminalPane` spells it out under the terminal itself (see `KeyboardHint`),
and the terminal's input element points at that text via `aria-describedby` so it's announced on
arrival, not only readable by sighted users.

Two skip links also sit at the top of the panel: one back to the installer content and, once the
terminal is actually usable, one straight into the terminal's input (expanding the panel first if it
was minimized), so a keyboard user can jump in and out without tabbing through every panel control
each time.

## Opening the terminal

The toggle lives in two places, deliberately presented differently:

- In the "More options" (⋮) menu ([`InstallerOptionsMenu`](../web/src/components/core/InstallerOptionsMenu.tsx)),
  present on every page, it's a standalone entry: "Open terminal" /
  "Close terminal".
- On the installation-failure screen ([`InstallationFailed`](../web/src/components/core/InstallationFailed.tsx)),
  where a shell is one of the more likely things to reach for, it's nested as
  a secondary option next to the primary "Download logs" action (a
  [`SplitButton`](../web/src/components/core/SplitButton.tsx)).

Either one just calls `toggle()` from `useTerminal()`. Because `TerminalDock`
is mounted above the stage-driven swap between the pre-install wizard, the
installing/failed/finished screens (see `App.tsx`), a session started before
installing keeps running — and stays reachable — through all of them.

## Small screens

Below 1024×768, `TerminalDock` decides there isn't room for both the application and a usable
terminal, and `TerminalPane` shows an explanatory message instead
([`TerminalUnavailable`](../web/src/components/core/TerminalUnavailable.tsx)): _"The terminal
requires a larger screen size"_, with a button to close the panel. This is evaluated live (via a
`ResizeObserver` on the whole dock), so resizing the browser window, or increasing its font/zoom
level, toggles between the two at any time — including while a session is already running: it keeps
going, invisibly, and the terminal reappears (re-attached, not recreated) once there's room again.

## Appearance

The terminal surface always looks like a dark console, independently of the active PatternFly theme
or product appearance so a console reads as a console regardless of light/dark mode. Its two colors
are still theme roles rather than literals, so the panel chrome and the terminal itself (drawn by
xterm.js, which needs plain color strings rather than CSS) cannot drift apart:

```scss
// web/src/assets/styles/tokens/_semantic.scss
--agm-t--terminal--background--color: #1e1e1e;
--agm-t--terminal--color: #d4d4d4;
```

Everything else about the panel (spacing, borders, the resize handle) follows the regular PatternFly
design tokens, so it still adapts to the active theme; see
[`_terminal.scss`](../web/src/assets/styles/components/_terminal.scss).

## Security

The terminal is a root shell on the system being installed, reachable by anyone who can reach the
web UI's API. It is protected by exactly the same bearer-JWT authentication as the rest of the
`/api` routes (see [`WEB-SERVER.md`](../rust/WEB-SERVER.md)) — there is no additional
terminal-specific access control, and no sandboxing or command filtering of any kind: whoever holds
a valid token gets an unrestricted shell.
