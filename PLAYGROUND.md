# Storage page: seventh iteration playground

## Why

The sixth iteration offered each device's panel actions from its row. This
round adds the one choice the panel makes about what is already on a device,
and puts the row menus in order.

## What changed in this round

- A row's menu offers "Existing partitions" ("Existing logical volumes" on a
  volume group), with the panel's three choices: keep, shrink if needed, or
  delete them. They replace the menu, with a way back named after them (or
  open to its side, from the console). The one in effect is checked. Offered
  where the panel offers it: a device with something today the new system
  does not use.
- Row menus in groups: Details; then what goes on the device (existing
  partitions, add a partition); then acts on the device as a whole (move to
  another device, create a volume group on it); then Do not use.
- "Move to other device" is now "Move to another device", in the menu and in
  the panel.
- No rule between the settings line and the devices table.
- Menu item names wrap instead of being cut short.
- Menus with a fly-out keep it inside the window, flipping it to the left or
  moving it up as needed, and tell screen readers it opens a menu and which
  choice is checked.

## From the sixth round

- Each row's menu offers what the device's panel offers, without opening the
  panel, in the same cases:
  - a disk or RAID with partitions planned: Add partition, Move to other
    device;
  - one with nothing planned yet: Add partition, Format device;
  - one given whole to a file system: Edit file system, Stop using as file
    system;
  - a volume group, new or existing: Add logical volume.

  The menu in the panel's own header leaves them out, since the panel shows
  them under its sections.

- "Add more devices" is now two buttons: "Add existing disk" (or "Add existing
  device", where the machine also has RAIDs or volume groups) and "Create LVM
  volume group". Where nothing is left to add, the first stays focusable but
  disabled, with the reason written under the buttons.

## How to play

Start the development server against any Agama machine:

    cd web
    AGAMA_SERVER=https://<agama-machine> npm run server

A machine with several disks, an existing volume group or a RAID shows the
table best. The screenshots in the shared documents come from a made-up machine
like that (two NVMe disks, one with Windows, a RAID and an existing volume
group), answered by a local mock of the API that is not part of this branch.

Then, from the browser developer tools console:

| Call                                  | What it does                                    |
| ------------------------------------- | ----------------------------------------------- |
| `agamaDevicesBox(false)`              | Devices right on the page (default)             |
| `agamaDevicesBox(true)`               | Devices in a bordered box                       |
| `agamaGroupedTable(true)`             | Grouped by kind (default)                       |
| `agamaGroupedTable(false)`            | One flat list of devices                        |
| `agamaGroupTitleStyle("band")`        | Group titles on a band fading down (default)    |
| `agamaGroupTitleStyle("flat")`        | Group titles on a flat faint band               |
| `agamaGroupTitleStyle("plain")`       | Group titles as small capitals on the page      |
| `agamaNamesStyle("mono")`             | Names in Used for in monospace (default)        |
| `agamaNamesStyle("plain")`            | Names in Used for in the body face              |
| `agamaExistingDataWording("short")`   | Kept, May be shrunk, All deleted                |
| `agamaExistingDataWording("verbose")` | Current partitions kept, ... (default)          |
| `agamaExistingDataWording("blunt")`   | No changes, May shrink, Wiped                   |
| `agamaExistingDataWording("loss")`    | All kept, Possible data loss, Data loss         |
| `agamaSummaryWording("when")`         | "When the installation starts, ..."             |
| `agamaSummaryWording("until")`        | "Nothing is changed until ...", in two lines    |
| `agamaSummaryWording("single")`       | What applying takes + quiet note (default)      |
| `agamaSummaryStyle("plain")`          | Summary as a line on the page (default)         |
| `agamaSummaryStyle("hint")`           | Summary in a PatternFly hint box                |
| `agamaActionCount("all")`             | Count every action, as "N actions" (default)    |
| `agamaActionCount("noSubvolumes")`    | Leave Btrfs subvolumes out, as "N actions"      |
| `agamaActionCount("changes")`         | Leave Btrfs subvolumes out, as "N changes"      |
| `agamaFailedDetails("popup")`         | Failure suggestions in a popup (default)        |
| `agamaFailedDetails("expandable")`    | Failure suggestions opening in place            |
| `agamaSpacePolicyMenu("drilldown")`   | Space policy choices replace the menu (default) |
| `agamaSpacePolicyMenu("flyout")`      | Space policy choices open to the side           |
| `agamaPinnedResult(true)`             | Dock the result preview (also its button)       |
| `agamaPinnedResult(false)`            | Put it away (default)                           |

Every choice is kept across reloads; the docked preview only for the session. WORDING.md lists every wording of the
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
- **The space policy fly-out.** Whether a choice this weighty belongs in a
  row's menu, and its name.
- **The row menus.** Whether offering the panel's acts from each row helps, or
  makes the menus too long.
- **The two add buttons.** Their names, and whether two buttons read better
  than one menu.
- **The docked preview.** The whole interaction: whether watching the result
  beside the page while editing devices is worth the room it takes, and how
  it feels at 1024 px.
- **The icon of the panel's close button.** The collapsed panel icon, the
  reverse of the docking one, or a plain close cross.

## To re-evaluate later

- **Fly-outs on narrow screens.** On a phone-sized window there is no room
  on either side, and the space policy fly-out runs off the screen. There it
  should become a drill-down, the choices replacing the menu with a way back.
  The drill-down, now the default, already avoids it; the fly-out stays
  available from the console.
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

- Tests are not updated to these changes, nor written for the new pieces:
  that waits for the design to be approved.
- The switches are playground code, to be dropped once a direction is chosen.
