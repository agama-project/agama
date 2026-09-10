# Web Terminal — Follow-up Fixes

Findings from the review of PR #3868 ("Add a web terminal to Agama's web UI").
All three issues found have been fixed:

- WebSocket reconnect backoff, see `web/src/hooks/use-terminal-session.ts`.
- A possible busy-loop between pty EOF and process reap, and the actual bug
  it was hiding: on Linux, a pty master read returns `EIO`, not a clean EOF,
  once the shell's side has closed. The read loop treated that `EIO` as a
  hard error and broke immediately, skipping the "shell exited" message and
  the graceful close entirely, and dropping the connection right away
  instead — indistinguishable, from the client, from a real dropped
  connection. Combined with the reconnect-on-drop logic, that meant typing
  "exit" or pressing Ctrl-D handed the user a brand new shell, with no way
  to leave the terminal from the keyboard. Fixed in
  `rust/agama-server/src/terminal/web.rs` (see
  `test_exit_is_reported_before_a_graceful_close`), together with the
  busy-loop itself (both share the same root cause: nothing stopped
  `output.next()` from being polled once the pty side was done).
- Terminal losing its DOM attachment when the panel toggled in/out of "not
  enough space" (resizing the browser window, or increasing its font size,
  below the 1024×768 threshold and then back above it): `TerminalPane`
  unmounts and remounts the container `<div>` on every such toggle (see
  `TerminalDock.tsx`), but `terminal.element` is set once by xterm.js and
  never cleared, so `if (!terminal.element) { terminal.open(container); }`
  only ran the *first* time a container appeared — the panel came back blank
  and impossible to type into, even though the session underneath was still
  alive (minimizing and closing still worked, since those only touch
  React/context state, not the orphaned xterm DOM element).

  Simply calling `terminal.open(container)` again on every container change
  does *not* fix this: xterm.js's own `open()` (see
  `CoreBrowserTerminal.ts`'s `open()`) only re-parents to a different
  *browser window*; called again on an already-open terminal in the same
  window, it is a no-op. Fixed in `use-terminal-session.ts` by manually
  moving the existing `terminal.element` into the new container
  (`container.appendChild(terminal.element)`) whenever its parent no longer
  matches, instead of relying on `open()` for anything but the first
  attachment (see `"re-attaches to a new container after the old one is
  unmounted"` in `use-terminal-session.test.ts`).
