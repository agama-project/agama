# Storage POC playground

A proof of concept for the redesigned main storage page. It was used to look at
the design and argue about it, round after round, before the real page was
built on the `storage-main-page` branch. Nothing here is meant to be merged.

Use it to see how the page is supposed to look and behave. Do not use it as a
model for how the code should be organised: every arrangement under discussion
is kept one switch away, in one very long file.

## Running it

It works in two modes:

- **Real** (the default): it reads the real config model, system and proposal,
  writes through the real endpoint, and opens the real forms.
- **Mocked**: pick a scenario (see below) and the page reads a made-up machine,
  configuration and proposal from `StoragePlanScenarios.ts` instead. Edits stay
  in memory and nothing is sent to the server, so it is safe to use on any
  machine. Use this to see states your own disks cannot produce.

Either way, the app needs a running backend to load and log in.

```
cd web && npm install && npm run server
```

| Route | What it is |
| --- | --- |
| `#/storage-plan-playground` | The main one: the storage page redesigned as a plan |
| `#/storage-primary-detail-card-playground` | An earlier primary/detail layout, in a card |
| `#/device-picker-playground` | Unrelated scratch for the network device picker |

In the browser console:

- `storagePlan.help()` lists every switch. They are also in the **Variants**
  panel at the bottom right of the page.
- `storagePlan.data("<scenario>")` switches to mocked mode. The scenarios are
  `one-disk-in-use`, `alongside-windows`, `empty-disk` and
  `lvm-over-three-disks`. A rough stand-in for the solver runs behind them, so
  changing the space policy still changes the page. The mocks cannot fail, so
  the error state only shows in real mode.

Two switches are still open questions:

- `wayIn`: is the device sheet opened from the device named in the sentence, or
  from a button under it?
- `spaceShape`: does the space decision show all four answers, or only the one
  the plan has?

`panelMode` and `page` are just shortcuts to states that are otherwise hard to
reach. The other switches are settled.

## Files

- `StoragePlanPlayground.tsx`: the page, the device sheet, the variants.
- `StoragePlanScenarios.ts`: the mocks, meaning the made-up machines and the
  solver stand-in.
- `StoragePrimaryDetailPlayground.tsx`, `StoragePrimaryDetailCardPlayground.tsx`:
  the earlier primary/detail exploration.
- `network/connection-form/DeviceDetailsPlayground.tsx`: the network scratch.
- The temporary routes in `router.tsx`.

## What the commit history did

The history is kept on purpose: each commit message says what changed and why.
In order, it went like this.

### 1. Dialog groundwork

A few real refactors the playground builds on, in commits prefixed with
`refactor(web)`/`fix(web)`: `core/Popup` exported by name, dismissible dialogs
closed as dialogs, a shared `QuestionDialog` for the questions, and some dialog
API cleanups (DeviceSelectorModal, LicenseDialog, the close-only action).

### 2. The device sheet (rounds 13 and 14)

The panel that opens for a device got its final structure:

- tabs for **Final layout**, **Planned content** and **Current content**, with
  a count on each content tab
- a shape of Planned content for each kind of device, and a physical volume
  points to the group that uses it
- every tab opens with a short statement of what it holds and where to change
  it. Many rounds went into how that statement is marked and styled.
- the space decision sits above the table it governs, and each option says what
  it means before you pick it
- the boot table left the boot panel, the tab strip stays pinned while the
  panel scrolls, and more of the layout was handed over to PatternFly

`ProposalResultTable` learned to show only the devices it is given, and a row
says in words what happens to it instead of showing a label.

### 3. The summary page (iteration 1)

The page in front of the sheet:

- a plan of **one device** gets a sentence about that device. A plan of
  **several** gets a sentence about the plan with an index of entries under it.
  Both start from the same skeleton.
- the target control moved into the sheet header, beside the device name
- the sentence (later only the disk name in it) is the way into the sheet
- scenarios were added so the page can be looked at against disks nobody has
- the installation's own decisions (boot, encryption) are read before what the
  page reports
- the way to add a device lives with the list it adds to
- the space decision is offered where its consequence is read, and a shrink is
  marked and coloured as a squeeze
- the page moves aside for the sheet instead of being squeezed, and lays itself
  out against the room it actually has
- when the proposal fails, what went wrong shows where the report would have
  been

`core/Interpolate` gained numbered placeholders for this.

### 4. After the team review (iteration 2)

- the management menu went back to the page header, and reset stays where it was
- boot options became a page, not a sheet
- the empty state went away and the sentence carries the device
- the space decision on the page got two candidate shapes (the `spaceShape`
  switch)
- the Result sheet is named after the count that opens it
- the page's own top line holds the installation decisions as small controls
  and says what the page is for in six words
- what the plan costs is one report block, with the worst thing in front of
  the count
- using another device became an offer, not a second call to action
- the device name is the way into its sheet, and a Windows scenario was added

### 5. Last round: rows, sheet and pages

- a row's menu opens the row and names its actions once, and destructive
  actions stay in the menu that holds them
- when a device cannot be swapped, the reason is given where the swap is
  offered
- counts cover what the plan builds, not what the device already has, and a
  move is not offered when there is nothing to move
- what the plan destroys is kept apart from the way to inspect it
- the one-device row gets adding a device, with the weight on changing the
  named disk
- a volume group shows what it is built on before what it will hold, and a
  defined entry gets a tab for what defines it
- the window width decides whether the sheet overlays the page or sits beside
  it. Beside it, the sheet takes half the width.
- encryption became a page, as boot options already had
