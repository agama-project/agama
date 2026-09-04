# Web Terminal — Follow-up Fixes

Findings from the review of PR #3868 ("Add a web terminal to Agama's web UI").
One issue was fixed directly (WebSocket reconnect backoff, see
`web/src/hooks/use-terminal-session.ts`); the remaining two are tracked here
for follow-up.

## 1. Terminal loses its DOM attachment when the panel toggles in/out of "not enough space"

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

## 2. Possible busy-loop between pty EOF and process reap

**File:** `rust/agama-server/src/terminal/web.rs` (session read loop)

```rust
chunk = output.next() => {
    match chunk {
        ...
        None => {
            // The pty's read side closed; the shell is about to exit
            // (handled by the child.wait() branch below).
        }
    }
}
```

`tokio_util::io::ReaderStream` is fused: once it returns `None` (pty read
side closed / EOF), it immediately returns `None` again on every subsequent
poll. Since this branch does nothing but fall through to the top of the
`select!` loop, and `socket.recv()` is typically `Pending` while waiting for
user input, the loop could spin tightly re-polling `output.next()`
(immediately ready) until `child.wait()` resolves.

In practice the window between pty EOF and process reap should be very
short, so the practical impact is likely negligible. It's worth confirming
there is no plausible case (e.g., a shell that forks a detached background
process that briefly holds the pty open after the main shell process itself
has already been reaped, or vice versa) where this window is non-trivial.

**Suggested fix (if confirmed necessary):** break out of the read loop, or
add a short yield/sleep, once `output.next()` returns `None`, instead of
continuing to poll it on every loop iteration.
