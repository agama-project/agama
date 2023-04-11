# A Proposal for the Storage User Interface

## Previous Considerations

### Don't Take Mock-ups Too Seriously

First of all, bear in mind the screenshots are far from being a faithfull representation of the
final look & feel. This document presents the concept focusing on the elements that should be there
and how they will interact. Something that is represented as a sentence in the screenshots can
become a tool-tip, a given icon can become a label, actions grouped in a drop-down can end up
being represented as separate buttons, etc.

### Representation of the Actions to Perform

Another important point to consider is that currently the list of (libstorage-ng) actions is the
only way we have to represent the result of a given proposal. That representation is far from ideal.
It doesn't offer a convenient high-level view of the final layout or of the really significant
actions (it includes too many intermediate steps by default).

A complete design for a more convenient representation of the result is out of the scope of this
proposal. Nevertheless, small changes (like grouping the actions based on the operating system
they affect) are somehow suggested in some of the upcoming sections and mock-ups.

In the long term, we may need to come with a better alternative to show the result.

### Volumes in the YaST Proposal

The YaST proposal heavily relies in the concept of the so-called volumes. Those volumes, that are
different for every product or system role, describe the partitions or LVM logical volumes to be
created during the process.

In YaST, every volume specifies two different kinds of lower size limits. The so-called "desired
size" that is the smallest size that is recommeded for a normal usage of that volume and the "min
size" that is the lower threshold for the volume to be minimally useful. On top of that, every
volume has a "weight", used to adjust how the available space is distributed among the volumes.

On the other hand, the maximum size for a given volume can be configured with the optional "max
size". But that value can be overridden if LVM is used by the also optional "max size LVM".

Experience has shown that people in charge of defining the volumes for each product struggle to
grasp the concepts of desired size, min size and weight. The flexibility and level of customization
they provide doesn't seem to pay off for the confusion they introduce.

Volumes at Agama will only have a minimum size and (optionally) a maximum one. No "desired size",
"weight" or "max size LVM".

### Calculating How to Make Space

Although Agama reuses part of the internal logic of YaST, there is no need to reproduce all
YaST behaviors.

YaST's `GuidedProposal` contains a subcomponent called `SpaceMaker` which takes cares of deleting
and resizing existing partitions to make space for the new system. It decides by itself which
partitions should be affected following a logic that, even though is configurable in the control
file and by the UI, is hard to follow for many end users.

### Reusing LVM Setups

For historical reasons, YaST tries to reuse existing LVM volume groups when making a proposal. That
behavior can be very confusing in many situations. To avoid the associated problems, the Agama
storage proposal will not automatically reuse existing LVM structures.

### About the Initial Proposal

Currently YaST tries really hard to present an initial proposal to the user, even if that implies
several subsequent executions of the `GuidedProposal`, each of them with a less ambitious
configuration. For that it relies on two features of the so-called volumes (volumes are already
described at *Volumes in the YaST Proposal*):

- First of all, every volume specifies both a "min size" and a "desired size".
- On the other hand, some features of a volume are marked as optional in the control file. That
  includes the usage of snapshots, the ability to expand based on the RAM size or even the existence
  of the volume at all.

YaST performs an initial execution of the `GuidedProposal` using the desired sizes as starting point
and with all the optional features set at their recommended values. If that fails, it runs
subsequent attempts until a proposal is possible. For that it fallbacks to the min sizes and
disables volumes (or volume features) in the order specified in the control file. It also explores
the possibility of using the different disks found on the system.

That behavior almost guarantees that YaST can make a storage proposal so it's possible to install
with an empty AutoYaST profile or by simply clicking "next, next, next" in the interactive
installer. But it is not very self-explanatory. To somehow explain what happened, YaST shows a
sentence like these next to the result of the current proposal:

- "_Initial layout proposed with the default Guided Setup settings_"
- "_Initial layout proposed after adjusting the Guided Setup settings_" (see screenshot).

![Guided Setup result at YaST](images/storage_ui/yast_guided_result.png)

As mentioned before, Agama doesn't need to replicate all YaST behaviors or to inherit its
requirements and expectations. It's possible to adopt the same approach or to go all the way in the
other direction and try by default to execute a variant of the `GuidedProposal` only once, with:

  - A single disk as target (chosen by any criteria)
  - A simple strategy for making space (eg. wiping the content of the disk)
  - Using the default settings for all volumes

If that execution of the `GuidedProposal` fails, then Agama could simply show a message like:
"it was not possible to calculate an initial storage layout".

The interface proposed in this document will work equally whatever approach is decided for the
initial storage proposal of Agama.

## General Workflow

Having all the previous considerations in mind, let's describe how the general user interaction will
work.

The summary page of Agama would display the result of the current storage proposal (or a
message about the failed initial calculation) and a link to modify that layout. That link will lead
to the page that allows to (re)configure and (re)calculate the storage proposal and that is
described at *The Proposal Page*.

The Agama storage proposal will be the only mechanism to define the file systems of the new operating
system (including their mount points, subvolumes and options for formatting or mounting). This
proposal is similar to the `GuidedProposal` implemented by YaST. As such, the resulting file systems
will actually be defined as a set of so-called volumes very similar to the YaST ones (although we
may need to find a better name).

Sometimes a previous setup may be needed in order to prepare the devices used by that proposal
mechanism. That includes actions like connecting to some iSCSI disks, activating and formating
DASDs, creating a software-defined RAID or setting an advanced LVM layout potentially including
several volume groups or thin-provisioned volumes. Those actions will in general modify the system
right away, instead of just planning actions to be performed during installation. Access to those
preliminary actions will be available from the Agama advanced menu in the side bar and their general
functionality is briefly described at *Advanced Preparations*.

## The Proposal Page

### General Description of the Proposal

The following interface will allow to configure the Agama storage setup for installation. Note the
mock-ups do not display an initial proposal, but the status after some manual changes done by the
user.

![Initial storage screen](images/storage_ui/agama_guided.png)

The table with the file systems actually represents the volumes used as input for the Agama variant
of the `GuidedProposal`. Compared to YaST, Agama turns the volumes into a much more visible concept.
The users will be able to see and adjust most of their attributes. Users could even define new
volumes that are not initially part of the configuration of the selected product.

Every change to any of the aspects in the "settings" section will result in an immediate
re-calculation of the "result" section. Changes in the configuration of LVM and encryption can also
imply refreshing the description of the volumes.

Pop-ups will be used to modify the advanced LVM settings (if any), the encryption configuration and
to add or edit a given volume.

The size of each volume is specified as a couple of lower and upper limits (the upper one is
optional in all cases). With the current approach of the YaST `GuidedProposal` there are some
volumes that may need to recalculate those limits based on its configuration or its relationship
with others volumes. Their limits will be set as "auto-calculated" by default. For more details,
see the corresponding section below.

By default, all volumes will be created in the boot disk (for partitions) or in the default LVM
volume group (for logical volumes). But the user will be able to manually overwrite that for a
particular volume. In the screenshot above that has been done for the volume at `/home`.

Similarly, it will be possible to specify that a given volume will re-use an existing partition or
logical volume, either re-formatting it in the process or not. In any case, size limits cannot be
adjusted for re-used devices. The size of the re-used device will be displayed.

Defining the settings and the list of volumes also defines, as a direct consequence, the disks
affected by the installation process. It may be needed to make some space in those disks. Clicking
on the current "policy to make space" will open a pop-up to define how to do it, described in the
corresponding section below.

### Automatic Size Limits

Currently there are cases in which the lower and upper limits of a given volume are adjusted for
the `GuidedProposal` based on the following aspects:

- Whether snapshots are activated for the root volume
- Whether the size of the volume must be influenced by the RAM size (used for suspend in the case
  of swap and for Kdump in the case of the root volume)
- Whether the given volume is marked as "fallback" for another one (eg. if the separate /home is
  disabled then the upper limit of the root one disappears)

To make that possible, the size limits of the volumes that are affected by one or several of those
circumstances will be set as "auto-calculated" by default. If that's the case, a tool-tip will be
available next to each set of limits to explain the rationale of the current values.

Let's consider the following example in which some volumes are configured like this for the product
being installed:

```yaml
volumes:
- mount_point: "/"
  min_size: 5 GiB
  max_size: 20 GiB
  # Sizes are multiplied by 3 if snapshots are configured
  snapshots_percentage: 200
  ...
- mount_point: "/home"
  min_size: 10 GiB
  max_size: unlimited
  # If this volume is disabled we want "/" to increase
  fallback_for_max_size: "/"
  ...
```

The list could start with something like this.

![Automatic Sizes Example Step 1](images/storage_ui/automatic_size_example1.png)

The reason for the "auto-calculated" value would be explained to the user via a tool-tip (or similar
mechanism) with a text similar to this (very crude wording, to be refined):

```
These limits are affected by::
  - The configuration of snapshots
  - The presence of a separate /home volume
```

As a consequence of all that, if the user deletes the /home volume then the new list would be (note
the change in the automatic size limits of the root volume).

![Automatic Sizes Example Step 2](images/storage_ui/automatic_size_example2.png)

If, on top of that, the user also disables snapshots the new resulting list would be.

![Automatic Sizes Example Step 3](images/storage_ui/automatic_size_example3.png)

Of course, at any point in time the user could modify the root volume and switch to fixed (ie. not
auto-calculated) limits. In that case, the entered values would be observed and would not be
automatically recalculated anymore, despite any configuration for the default volumes.

### Making Space for the Volumes

Similar to YaST, Agama will offer by default the option to automatically make space for the new
operating system reusing the internal mechanisms of the previously mentioned `SpaceMaker`, but the
exact algorithm will be different and way less configurable (to reduce confusion).

As an alternative, the Agama proposal will offer a manual mode in which the user will explicitly
select which partitions to keep, delete or resize.

That will result in up to four possibilities presented in the corresponding pop-up dialog (it's
still undecided what will be the exact wording used to describe them in the user interface):

- Delete everything in the disk(s). Obviously, all previous data is removed.
- Resize existing partition(s). The information is kept, but partitions are resized as needed to make
  enough space.
- Do not modify existing partition(s). The installation will only succeed if the disk(s) already
  contains suitable free spaces.
- Custom. A user interface will allow the user to specify what to do with every individual partition
  in the affected disks: resize it, delete it or keep it as it is.

In general, the interface of this pop-up should put the focus in the operating systems found in the
affected disks. Even if the custom mode allows to indicate individual actions per partition, the
relationship between every one of those partitions and the installed operating system they belong to
should be as visible as possible.

## Advanced Preparations

As mentioned above, in addition to the page for defining the proposal, Agama will offer interfaces to
perform some preparatory actions like managing DASDs or setting up complex RAID or LVM layouts.
Those interfaces will never replace the storage proposal as the only way to define the file systems of
the installed system. Instead, they will operate right away in the system to configure the devices
to be used by the proposal.

Some of those interfaces already exist, like the one that allows to connect and disconnect to iSCSI
targets or the one to manage DASDs. Currently they can be reached through the advanced options menu
at Agama's side bar.

There will also be interfaces to:

- Manage software-defined RAIDs
- Manage Bcache devices
- Define custom LVM setups
- Manipulate partitions in the disks or in any of the RAID and bcache devices

Since all those actions are interrelated (eg. the user often creates partitions that are combined
into a RAID that is then used as an LVM physical volume), the final user interface will likely
resemble the traditional YaST Expert Partitioner. But, since the scope of such a tool will be
limited to preparing the disk for the proposal, it will not allow to format devices or to define
mount points for the target system. After defining all the actions to be performed, the changes will
be committed to the system before returning to the proposal page.

## Other Use-Cases

The proposed workflow and interfaces should cover most of the known installation use-cases.
Nevertheless further improvements may be needed to accommodate scenarios like re-installing the
system in a similar way to the option "Import Mount Points" from the YaST Partitioner, which can
effectively be done by tweaking the proposal options to reuse the appropriate devices.

