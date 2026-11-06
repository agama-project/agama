# Storage page playground: wording

Every wording tried for the storage page in the fourth iteration, the ones
kept and the ones discarded, so whoever picks the work up can see what was
weighed and why. Bold in the examples is bold on the page.

## The devices table

### Column headers

| Kept                                | Discarded                                                |
| ----------------------------------- | -------------------------------------------------------- |
| **Device**, **Used for**, **Existing data** | Device, Purpose, Consequence                     |
|                                     | Device, Used for, Consequence                            |

"Used for" is plainer than "Purpose". "Existing data" says what the
consequence is about, while "Consequence" on its own sounds alarming.

The columns match the three lines master shows for each device, in order: the
device, what it is used for (master's expandable second line) and what happens
to its current content (master's third line, a dropdown).

### Used for

What the new system uses each device for. Mount points and volume group names
are set in monospace by default (`agamaNamesStyle`), so "/" is not lost among
the words and "and" is not read as one more value.

| Case                                  | Master                                                | Kept                         |
| ------------------------------------- | ----------------------------------------------------- | ---------------------------- |
| Partitions for mount points           | Partitions will be used and created for / and swap    | / and swap                   |
| One file system over the whole device | The whole device will be used for /home               | /home (whole device)         |
| Same, not mounted                     | A file system will be used for the whole device       | File system (whole device)   |
| Holds LVM physical volumes            | Create LVM physical volumes for system                | Volume group system          |
| Holds the boot partitions             | Configure partitions to boot                          | Boot partitions (own line)   |
| Added, nothing planned on it          | Nothing planned yet, will be skipped                  | Nothing yet (skipped)        |
| Volume group with no logical volumes  | No logical volumes defined                            | Nothing yet (provisional)    |

Discarded:

- Partitions: "Partitions for / and swap", "/, swap".
- Whole device: "/home, no partitions", "Whole device: /home".
- LVM: "LVM system", "Part of system".
- Boot: in the same list ("/ and swap, boot partitions"), left out of the table
  (the top line already says "Boot disk: sda"), or a boot mark beside the
  device name. A line of its own keeps the list of mount points pure.
- Nothing planned: "Nothing", "Not used", "Skipped".

Not covered yet: a disk that is a member of a RAID ("RAID md0" was agreed but
the configuration does not list such members today).

### Existing data

What happens to what a device holds today. Anything that deletes, or may
delete, is in **bold**. Not settled: four sets can be compared from the console
with `agamaExistingDataWording`.

| Case                                    | short (default)                     | verbose                                          | blunt                       | loss                    |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------ | --------------------------- | ----------------------- |
| Nothing touched                         | Kept                                | Current partitions kept                          | No changes                  | All kept                |
| May be shrunk                           | May be shrunk                       | Partitions may be shrunk                         | May shrink                  | All kept, may be shrunk |
| May be deleted                          | **May be deleted**                  | **Partitions may be deleted**                    | **May delete**              | **Possible data loss**  |
| May be deleted or shrunk                | **May be deleted or shrunk**        | **Partitions may be deleted**                    | **May delete or shrink**    | **Possible data loss**  |
| Some deleted                            | **1 partition deleted**             | **1 partition deleted**                          | **1 deleted**               | **Data loss**           |
| Some deleted, others may be shrunk      | **1 deleted, others may be shrunk** | **1 partition deleted, other partitions may be shrunk** | **1 deleted, may shrink** | **Data loss**     |
| Everything deleted                      | **All deleted**                     | **All content deleted**                          | **Wiped**                   | **Data loss**           |
| Everything deleted but what is reused   | **All deleted except reused**       | **All content deleted except reused partitions** | **Wiped except reused**     | **Data loss**           |

Volume groups say "logical volume(s)" where disks say "partition(s)".

Notes:

- Counts are real numbers, not master's "Several partitions will be deleted".
- "All deleted except reused" is used only for a device set to delete
  everything (master: "All content not configured to be mounted will be
  deleted"). A device where some partitions are deleted one by one says how
  many instead.
- A device turned into a single file system loses all its partitions, and
  says so.
- Discarded shapes: verb first ("Deletes 1 partition"), which reads oddly
  under the header "Existing data".

### A device with nothing on it yet

A volume group the installation creates has no existing data. Its cell is
visually empty and says "No existing data" to screen readers only.

Why: NVDA and JAWS say "blank" for an empty cell while moving through a
table, and VoiceOver says nothing or "empty". An empty cell is not broken, but
it can sound like missing information rather than "nothing to say". A dash is
worse: depending on punctuation settings it is read as "em dash" or skipped.
Visible "None" was discarded as redundant for sighted users. If the product
owner prefers the same text for everyone, "No existing data" can simply be
made visible.

## The summary at the top of the page

What the installer will do, plain text and not a caution. Only the count and
"with data loss" are in bold, never "without data loss". Three wordings can be
compared with `agamaSummaryWording`.

| Wording          | With actions                                                                                                     | No actions                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| when (default)   | When the installation starts, the installer will apply the settings below in **12 actions**, **with data loss**. | When the installation starts, nothing will be changed on the disks.           |
| until (2 lines)  | Nothing is changed until the installation starts.<br>Then the installer will apply the settings below in **12 actions**, **with data loss**. | Nothing is changed until the installation starts.<br>The setup below needs no changes to the disks. |
| single           | Nothing changes until the installation starts, which will apply the settings below in **12 actions**, **with data loss**. Details on the next line. | Nothing changes until the installation starts, and even then the disks stay as they are. (provisional) |

Without data loss, each ends "…in **12 actions**, without data loss."

Discarded:

- "…will perform **12 actions** to reach the setup below, with data loss": the
  first version, replaced by the shorter "apply the settings below in".
- "…will apply the settings below with 12 actions involving data loss".
- "…in 12 actions, some of them deleting data" / "…none deleting data".
- "…apply the settings below, losing data, in 12 actions".
- "Only when the installation starts will the installer apply…", "Once the
  installation starts, and not before, …", "The settings below are applied
  when installing, …".
- From the third iteration: "The setup below will be applied with potential
  data loss", drawn as a caution. The summary is a report, not a caution.

What is counted (`agamaActionCount`): every action as "N actions" (default),
leaving Btrfs subvolumes out as "N actions", or leaving them out as
"N changes".

The button after it reads "Details…", named "Details of the planned storage
changes" for screen readers. Once the planned changes differ from the ones
last reviewed, a blue dot marks it and its name becomes "Details of the
planned storage changes (updated)". Screen readers hear once: "The planned
changes are different since you last reviewed them."

## A setup that cannot be applied

Reported as a caution, unlike the summary, since it blocks the installation.

| Part                        | Wording                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Title                       | The configuration cannot be applied                                                    |
| In place, under the title   | Not enough space for the boot partition, "/opt" (100 GiB), "/" (at least 2 TiB) and "swap" (1 GiB - 2 GiB). |
| Action, popup version       | See suggestions… (screen readers: "See suggestions to make the storage setup fit")     |
| Action, in-place version    | See suggestions / Hide suggestions                                                     |

Discarded: the action in the title line ("The configuration cannot be applied
[Show details]"), "Show more", "How to fix it…", "What can I do?", and master's
"It is not possible to allocate space for…" for the in-place line.

Invalid settings list their issues in place under "The configuration is not
valid to install the system", with no action, since nothing more is behind it.
