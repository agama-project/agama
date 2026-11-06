# Storage page: fourth iteration playground

## Why

The third iteration made the storage page a table, like the other pages of
the installer built around a list of things, with a panel for the details of
each device. This round makes that table say less and say it better, and turns
the line at the top into a real summary of what the installer will do.

## What changed in this round

- The table has three columns, Device, Used for and Existing data, matching
  the three lines master shows per device: the device, what it holds, and what
  happens to what is on it today. Values are short and have the same shape on
  every row, so a column can be scanned instead of read.
- Losing data is in bold in the Existing data column. A device with nothing on
  it yet leaves that cell visually empty and says "No existing data" to screen
  readers only.
- The top of the page opens with a summary: when the installation starts, how
  many actions the installer will perform, and whether data is lost, with
  "Details…" opening the planned changes. It is plain text, not a caution:
  only the count and "with data loss" are in bold.
- The page description now sits on the same line as the boot disk and
  encryption settings.
- Once the planned changes have been reviewed, a new, different proposal puts
  a blue dot on "Details…", until they are reviewed again. Its name gains
  "(updated)" and screen readers hear once that the changes are different.
- A setup that cannot be applied is a caution at the top again, saying what
  does not fit in place, with the suggestions behind "See suggestions…".
- Mount points and volume group names in Used for are set in monospace.
- Group titles sit on a faint band; the last row of each group keeps its rule.
- The page scrolls as a whole, like every other Agama page, instead of the
  devices scrolling inside their own box under a fixed top area. Only the
  summary stays at the top, in the same sticky section (PatternFly's
  `stickyOnBreakpoint`) the software patterns page keeps its filter in, with
  the same placement, padding, background and shadow; the sticky section
  reaches the page's edges, on both pages. Boot disk, Encryption and the
  devices scroll away under it.
- The details panel covers everything but the summary, starting right under
  it, and stays in view as the page scrolls, fitting what is in view and
  scrolling its own content. Opening it never moves the page.
- The room around the page is master's again; prototyping had tightened it.
- The device links' `aria-controls` now always points at an element in the
  page. The panel is always rendered and only hidden while shut.
- The actions columns are named with visually hidden text instead of an
  `aria-label`.
- The Type column and the top line order switches are gone.

## How to play

Start the development server against any Agama machine:

    cd web
    AGAMA_SERVER=https://<agama-machine> npm run server

A machine with several disks, an existing volume group or a RAID shows the
table best. The screenshots in the shared documents come from a made-up machine
like that (two NVMe disks, one with Windows, a RAID and an existing volume
group), answered by a local mock of the API that is not part of this branch.

Then, from the browser developer tools console:

| Call                                    | What it does                                     |
| --------------------------------------- | ------------------------------------------------ |
| `agamaDevicesBox(false)`                | Devices right on the page (default)              |
| `agamaDevicesBox(true)`                 | Devices in a bordered box                        |
| `agamaGroupedTable(true)`               | Grouped by kind (default)                        |
| `agamaGroupedTable(false)`              | One flat list of devices                         |
| `agamaGroupTitleStyle("band")`          | Group titles on a band fading down (default)     |
| `agamaGroupTitleStyle("flat")`          | Group titles on a flat faint band                |
| `agamaGroupTitleStyle("plain")`         | Group titles as small capitals on the page       |
| `agamaNamesStyle("mono")`               | Names in Used for in monospace (default)         |
| `agamaNamesStyle("plain")`              | Names in Used for in the body face               |
| `agamaExistingDataWording("short")`     | Kept, May be shrunk, All deleted                 |
| `agamaExistingDataWording("verbose")`   | Current partitions kept, ... (default)           |
| `agamaExistingDataWording("blunt")`     | No changes, May shrink, Wiped                    |
| `agamaExistingDataWording("loss")`      | All kept, Possible data loss, Data loss          |
| `agamaSummaryWording("when")`           | "When the installation starts, ..."              |
| `agamaSummaryWording("until")`          | "Nothing is changed until ...", in two lines     |
| `agamaSummaryWording("single")`         | What applying takes + quiet note (default)       |
| `agamaSummaryStyle("plain")`            | Summary as a line on the page (default)          |
| `agamaSummaryStyle("hint")`             | Summary in a PatternFly hint box                 |
| `agamaActionCount("all")`               | Count every action, as "N actions" (default)     |
| `agamaActionCount("noSubvolumes")`      | Leave Btrfs subvolumes out, as "N actions"       |
| `agamaActionCount("changes")`           | Leave Btrfs subvolumes out, as "N changes"       |
| `agamaFailedDetails("popup")`           | Failure suggestions in a popup (default)         |
| `agamaFailedDetails("expandable")`      | Failure suggestions opening in place             |

Every choice is kept across reloads. WORDING.md lists every wording of the
table and the summary, the discarded ones included.

## Under evaluation

- **The grouped table.** A teammate's suggestion: each kind of device under
  its own title, sorted inside each group. Still open: whether "Used disk"
  should stay when there is only one, and room for actions beside a group's
  title.
- **The wording of the Existing data column.** Four sets to compare, none
  decided.
- **The summary.** Three wordings, two looks, and three ways of counting.
- **The failure suggestions.** In a popup or in place.
- **The group titles.** Fading band, flat band or none.

## To re-evaluate later

- **Announcements.** Screen readers hear the summary only when the setup
  starts or stops losing data, not on every change of the count, to avoid
  talking over the reader while they edit. Whether that is enough, or the
  count should be announced too, needs testing with real screen reader users.

## Known limits of the mocked machine

The local mock answers a fixed proposal per scenario, so editing settings does
not change the summary or the planned changes. To see the "updated" dot, open
Details once and then run `agamaMockProposalSwap()` (local mock only), which
swaps the proposal in place. Swapping back does not clear the dot, because the
mock rebuilds the proposal with its devices in a different order; with a real
backend, a setting set back by hand is expected to clear it.

## Not covered

- Tests are not updated to these changes.
- The switches are playground code, to be dropped once a direction is chosen.
