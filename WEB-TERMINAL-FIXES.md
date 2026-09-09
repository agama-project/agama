# Web Terminal — Follow-up Fixes

Findings from the review of PR #3868 ("Add a web terminal to Agama's web UI").
Two issues were fixed directly:

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

The remaining issue is tracked here for follow-up.

## Terminal loses its DOM attachment when the panel toggles in/out of "not enough space"

**File:** `web/src/hooks/use-terminal-session.ts` (DOM attachment effect)

```ts
useEffect(() => {
  const terminal = terminalRef.current;
  const fitAddon = fitAddonRef.current;
  if (!container || !terminal || !fitAddon) return;

  if (!terminal.element) {
    terminal.open(container);
  }
  ...
}, [container]);
```

`terminal.element` is set once by xterm.js and never cleared by this code, so
`terminal.open()` only runs the *first* time a container appears.

**Scenario that triggers it:** `TerminalPane` stays mounted for the whole
session lifetime, but the container `<div>` it renders is conditionally
swapped based on `enoughSpace` in `TerminalDock.tsx`, which is driven live by
a `ResizeObserver` watching the actual window size (not just checked on
mount). If the terminal is open and the user resizes the browser window
below, then back above, the 1024×768 threshold, React unmounts the old
container div and mounts a new one. `terminal.element` still points at the
detached node, so `terminal.open(container)` is skipped for the new node —
xterm.js keeps writing into a detached element, and the panel appears blank
(the session is still alive underneath) until the user closes and reopens
the terminal entirely.

No existing test covers "container changes after having already been opened
once" — `use-terminal-session.test.ts` only exercises the initial
`null -> container` transition.

**Suggested fix:** track re-attachment based on whether `container` actually
changed (e.g., a ref storing the last attached container), rather than a
one-shot check on `terminal.element`, so re-attachment happens on every
container swap.
