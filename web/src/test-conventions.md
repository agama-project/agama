# Testing conventions

Conventions for writing reliable unit tests across the web UI. It starts with
the topic that motivated it (timers and asynchronous UI) and should grow as more
recurring patterns are identified.

The examples are drawn from `DownloadFeedback` and its test
(`components/core/DownloadFeedback.test.tsx`), a component that shows a success
alert and auto-dismisses it after a timeout. Its tests failed intermittently on
CI until they were made deterministic, and serve as the running example below.

The golden rule: **a test must pass or fail for the same reason every time,
regardless of how fast or busy the machine is.** A test whose result depends on
wall-clock timing is not testing the code; it is testing the scheduler.

---

## Table of Contents

- [Why "random" failures happen](#why-random-failures-happen)
- [Deterministic timers](#deterministic-timers)
  - [The problem with real timers](#the-problem-with-real-timers)
  - [The pattern: fake timers](#the-pattern-fake-timers)
  - [Wiring userEvent to fake timers](#wiring-userevent-to-fake-timers)
  - [Observing a transient state before it disappears](#observing-a-transient-state-before-it-disappears)
  - [Preserving a mocked Date](#preserving-a-mocked-date)
  - [Why no manual `act`](#why-no-manual-act)
- [Quick checklist](#quick-checklist)

---

## Why "random" failures happen

Some tests depend on how much real time passes between triggering an action and
checking its result. When the machine is fast and idle that gap is tiny and the
test passes; when the machine is busy and the gap grows, the same test fails.
Nothing in the code changed, only the timing.

This is what makes these failures so slippery: they rarely reproduce on demand.
Running the full suite locally usually still passes, because a developer
machine is not under the contention a shared CI runner is. The fault is real and
always present, but only surfaces when something else loads the machine enough to
stretch that gap. (To reproduce one deliberately, run the test in a loop while
several busy background processes saturate the CPU.)

So the failures show up as a different test breaking every so often on CI, with
no commit to blame, and the tempting response is "just re-run it". The fix is
rarely "wait longer": it is to remove the dependency on real elapsed time, so the
outcome is decided by logic, not by timing.

---

## Deterministic timers

### The problem with real timers

`DownloadFeedback` schedules an auto-dismiss with `setTimeout`. A test that waits
for that work on the real clock is racing the component.

```tsx
// Component: dismiss the success alert after the download resolves
timeoutRef.current = setTimeout(() => setAlert(null), successTimeout);
```

```tsx
// ❌ FLAKY - races the real timer (the test used a 10ms timeout)
await user.click(downloadButton);
// By now the timer may have ALREADY fired, so the alert appeared and vanished
// in a window we never sampled.
await waitFor(() => screen.getByRole("heading", { name: /Success/ }));
// -> "Unable to find role=heading name 'Success'": the alert is already gone
```

`waitFor` polls at an interval (50ms by default). A 10ms real timer can fire
between two polls, so the transient state is invisible to the test. A bigger
timeout does not fix this, it only hides it: the appearance becomes observable,
but asserting the *dismissal* then needs a real wait just as long, which is slow
and still timing-dependent.

### The pattern: fake timers

Install Jest's fake timers so scheduled callbacks fire only when the test
advances the clock. Time stops being a race and becomes an input the test
controls.

```tsx
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});
```

Bonus: any timer the component leaves pending (e.g. the default 8000ms
auto-dismiss a test ignores) simply never fires and is discarded by
`useRealTimers()`. No need to flush timers, and no "state update on an unmounted
component" noise.

### Wiring userEvent to fake timers

`userEvent` schedules its own delays with timers, so under fake timers it hangs
unless told how to advance the clock:

```tsx
const { user } = render(ui, {
  userEventOptions: { advanceTimers: jest.advanceTimersByTime },
});
```

The shared `plainRender` / `installerRender` helpers accept `userEventOptions`
and forward it to `userEvent.setup`. Always pass it when a test combines fake
timers with user interaction.

### Observing a transient state before it disappears

Observe the appearance *before* advancing the clock, then let the clock move:

```tsx
await user.click(downloadButton);

// findBy* flushes the resolved download promise without advancing the clock,
// so the alert is observed while still shown.
await screen.findByRole("heading", { name: /Success/ });

// waitFor advances fake timers itself; the dismissal fires deterministically.
await waitFor(() =>
  expect(screen.queryByRole("heading", { name: /Success/ })).toBeNull(),
);
```

When the timer has been cancelled (e.g. the user closed the alert), advancing
the clock is a no-op and can be asserted synchronously:

```tsx
await user.click(closeButton); // clears the pending auto-dismiss timer

jest.advanceTimersByTime(20); // nothing scheduled fires; no state change
expect(screen.queryByRole("heading", { name: /Success/ })).toBeNull();
```

This replaces sleeping on the real clock to "give it time":

```tsx
// ❌ FLAKY - a real sleep that may be too short on a loaded machine
await new Promise((resolve) => setTimeout(resolve, 20));
```

### Preserving a mocked Date

Fake timers also replace the global `Date`. `DownloadFeedback.test.tsx` mocks
`Date` to assert the generated filename's timestamp, so it excludes `Date` from
the fake timers to keep that mock working:

```tsx
jest.useFakeTimers({ doNotFake: ["Date"] });
```

### Why no manual `act`

Advancing fake timers triggers React state updates, which normally need `act`.
React Testing Library's `waitFor` (and the `findBy*` queries built on it)
already wraps its work in `act` and advances fake timers for you, so driving
transitions through `waitFor` keeps tests free of explicit `act`. Reach for a
bare `jest.advanceTimersByTime` only when no state update results (such as
advancing an already-cancelled timer).

---

## Quick checklist

When a component uses `setTimeout`, `setInterval`, debouncing, or any delayed
behavior, the test should:

- [ ] Install fake timers in `beforeEach`, restore them in `afterEach`.
- [ ] Add `doNotFake: ["Date"]` if a mocked `Date` must survive.
- [ ] Pass `userEventOptions: { advanceTimers: jest.advanceTimersByTime }` when
      it also simulates user interaction.
- [ ] Observe transient states with `findBy*` before advancing the clock.
- [ ] Drive timer-based transitions through `waitFor`, not real `setTimeout` sleeps.
- [ ] Never assert "it happens within N milliseconds" against the real clock.
