# Testing conventions

Conventions for writing reliable unit tests across the web UI. This document
should grow as more recurring patterns are identified.

---

## Table of Contents

- [Shared test utilities](#shared-test-utilities)
  - [Rendering: plainRender vs installerRender](#rendering-plainrender-vs-installerrender)
  - [Mocking model data: jest.fn + setter + jest.mock](#mocking-model-data-jestfn--setter--jestmock)
  - [Override only what the test exercises](#override-only-what-the-test-exercises)
  - [Prefer accessible queries](#prefer-accessible-queries)
  - [Other helpers](#other-helpers)
- [Deterministic timers](#deterministic-timers)
  - [Why "random" failures happen](#why-random-failures-happen)
  - [The problem with real timers](#the-problem-with-real-timers)
  - [The pattern: fake timers](#the-pattern-fake-timers)
  - [Wiring userEvent to fake timers](#wiring-userevent-to-fake-timers)
  - [Observing a transient state before it disappears](#observing-a-transient-state-before-it-disappears)
  - [Preserving a mocked Date](#preserving-a-mocked-date)
  - [Why no manual `act`](#why-no-manual-act)
- [Quick checklist](#quick-checklist)

---

## Shared test utilities

`src/test-utils.tsx` centralizes rendering and the mocking of installer data, so
individual tests stay short and only spell out what they actually exercise.

### Rendering: plainRender vs installerRender

Both wrap React Testing Library's `render`, set up a `userEvent` instance, and
return `{ user, ...renderResult }`. They differ in how much of the app they
stand up:

- **`plainRender`**: minimal providers (query client, appearance, terminal). Use
  it for components tested in isolation. Note: a `core/Page` renders
  `core/Sidebar`, so testing a Page with `plainRender` requires mocking the
  sidebar, or the render crashes for lack of providers.
- **`installerRender`**: adds the installer client `Providers` and a
  `MemoryRouter`. Use it for components that need routing, navigation, or the
  installer client.

Both accept `userEventOptions`, forwarded to `userEvent.setup` (see
[Wiring userEvent to fake timers](#wiring-userevent-to-fake-timers)). For
TanStack Query hooks, use `installerRenderHook`.

### Mocking model data: jest.fn + setter + jest.mock

The recurring pattern for installer data is a module-level mock function, an
exported setter to drive it per test, and a `jest.mock` that points the real
hook at the mock:

```tsx
// in test-utils.tsx
const mockUseSystemFn = jest.fn().mockReturnValue({
  products: [],
  l10n: { locales: [], keymaps: [] }, // sensible empty default
});

export const mockSystem = (system: DeepPartial<System>) =>
  mockUseSystemFn.mockReturnValue(system as System);

jest.mock("~/hooks/model/system", () => ({
  ...jest.requireActual("~/hooks/model/system"),
  useSystem: () => mockUseSystemFn(),
}));
```

```tsx
// in a test
import { mockSystem, installerRender } from "~/test-utils";

mockSystem({ products: [tumbleweed], l10n: { locales, keymaps } });
```

The same shape backs `mockProduct`, `mockL10n`, `mockQuestions`, `mockProgresses`,
`mockStage`, `mockTasks`, and the router mocks (`mockRoutes`, `mockParams`,
`mockNavigateFn`).

### Override only what the test exercises

The default mock returns a minimal, valid value so components present on every
page (the system query, l10n, product) do not suspend or crash in tests that
don't care about them. A test then overrides just the slice it asserts on; some
setters (e.g. `mockL10n`) merge, so you pass only the changed field. Keep
fixtures focused: more data than the test needs makes it harder to see what is
under test.

### Prefer accessible queries

Query by role, label, and text, the way a user (or assistive technology)
perceives the UI, not by test IDs. When a structure needs a dedicated reader,
add it to `test-utils.tsx` rather than reaching for `data-testid`. `getColumnValues`
is an example: it reads a table column by its `data-label`, keeping assertions
tied to accessible markup.

```tsx
const table = screen.getByRole("table");
expect(getColumnValues(table, "Device")).toEqual(["/dev/sda", "/dev/sdb"]);
```

### Other helpers

- **`createCallbackMock`**: capture callbacks handed to a mocked function so the
  test can invoke them on demand (e.g. simulating a server event).
- **`resetLocalStorage`**: clear `window.localStorage` and optionally seed it.
- **`loadTranslations`**: load the real PO file for a locale in i18n tests.

---

## Deterministic timers

The golden rule: **a test must pass or fail for the same reason every time,
regardless of how fast or busy the machine is.** A test whose result depends on
wall-clock timing is not testing the code; it is testing the scheduler. The
examples below come from `DownloadFeedback` and its test
(`components/core/DownloadFeedback.test.tsx`), which failed at random on CI until
it was made deterministic.

### Why "random" failures happen

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

The same idea extends beyond timers. Two cases come up when testing hooks with
`renderHook`:

- **The action triggers no state update.** A hook built only on refs,
  subscriptions, or callbacks does not re-render, so emitting an event or writing
  to the query cache fires its callbacks synchronously with nothing to wrap.
  Check what the hook actually does rather than assuming; if no `setState` runs,
  no `act` is needed.
- **The test itself triggers a state update** by invoking a callback it captured
  from a mock (e.g. the `onSuccess` passed to a mocked hook). Call it from inside
  `waitFor` so the update runs within `act`; the body may run more than once, so
  keep that call idempotent.

```tsx
// mockRefetchCallback is captured from a mocked hook and calls setState.
// Invoking it inside waitFor runs that update within act.
await waitFor(() => {
  mockRefetchCallback(startedAt, completedAt);
  expect(result.current.loading).toBe(false);
});
```

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
