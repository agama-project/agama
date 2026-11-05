# Storage page: third iteration playground

## Why

This round tries to make the storage page look like the other pages of the
installer that are built around tables, such as Network, so that moving to a
panel with the details of whatever is picked in the table becomes easier, or
even possible, before the idea is dropped.

## What changed

- The devices are a table with visible headers (Device, Existing data, New
  system), grouped by kind: volume groups, RAID devices and disks, each under
  its own title, and sorted by device within each group.
- "Change target disk…" is an option of the disk's menu instead of a button
  beside the devices.
- The result is no longer an alert above the page. The line above the devices
  says whether applying the setup may lose data, with a "Details…" button
  opening the planned changes.
- A configuration that cannot be applied is reported in that same line too,
  instead of in an alert.
- The details panel opens over the devices only, so the line above them stays
  in sight.
- The devices sit on the page instead of in a bordered box, with a divider
  setting them apart from the line above.

## How to play

Start the development server against any Agama machine:

    cd web
    AGAMA_SERVER=https://<agama-machine> npm run server

A machine with several disks, an existing volume group or a RAID shows the
table best. The screenshots in the shared documents come from a made-up machine
like that (two NVMe disks, one with Windows, a RAID and an existing volume
group), answered by a local mock of the API that is not part of this branch.

Then, from the browser developer tools console:

| Call                               | What it does                        |
| ---------------------------------- | ----------------------------------- |
| `agamaTopLineOrder("description")` | Page description first (default)    |
| `agamaTopLineOrder("status")`      | Result and settings first           |
| `agamaDevicesBox(false)`           | Devices right on the page (default) |
| `agamaDevicesBox(true)`            | Devices in a bordered box           |
| `agamaGroupedTable(true)`          | Grouped by kind (default)           |
| `agamaGroupedTable(false)`         | One flat list of devices            |
| `agamaTypeColumn(false)`           | Flat list without Type (default)    |
| `agamaTypeColumn(true)`            | Flat list with a Type column        |

Every choice is kept across reloads.

## Under evaluation: the grouped table

The devices table opens grouped by kind, a teammate's suggestion: each group
with its own title and mark, and the column headers sorting the rows inside
every group. The branch this playground builds on already grouped the devices,
but as headed sections that hid the table they are, and less polished. A new
volume group says only "New" under its name, since the group title says the
rest. `agamaGroupedTable(false)` shows the flat table instead, to compare.

The Type column was an experiment along the way, to show the devices as the
table they are; it is discarded, since the groups say what each device is
better. `agamaTypeColumn(true)` brings it back in the flat table, only to
compare.

The grouped table is valid HTML and works with the keyboard and screen readers
as built, but it is not decided. Still open: whether "Used disk" should stay when there is
only one (it tells users these are the disks used for the installation, not
every disk they have), room for actions beside a group's title, and what the
two content columns should hold once the groups say what each device is.

## Not covered

- Tests are not updated to these changes.
- The switches are playground code, to be dropped once a direction is chosen.
