# Storage page: third iteration playground

## Why

This round tries to make the storage page look like the other pages of the
installer that are built around tables, such as Network, so that moving to a
panel with the details of whatever is picked in the table becomes easier, or
even possible, before the idea is dropped.

## What changed

- The devices are a regular table: one row per device, with visible headers
  (Type, Device, Existing data, New system), sortable by type and by
  device.
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
table best.

Then, from the browser developer tools console:

| Call                               | What it does                        |
| ---------------------------------- | ----------------------------------- |
| `agamaTopLineOrder("description")` | Page description first (default)    |
| `agamaTopLineOrder("status")`      | Result and settings first           |
| `agamaDevicesBox(false)`           | Devices right on the page (default) |
| `agamaDevicesBox(true)`            | Devices in a bordered box           |
| `agamaTypeColumn(true)`            | Type column shown (default)         |
| `agamaTypeColumn(false)`           | Type column left out                |

Every choice is kept across reloads.

## Not covered

- Tests are not updated to these changes.
- The switches are playground code, to be dropped once a direction is chosen.
