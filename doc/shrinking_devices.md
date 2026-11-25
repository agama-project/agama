# Shrinking Devices

This document describes all the considerations to decide whether a device can be safely shrunk.

## Resizing information at Y2Storage (and libstorage-ng) level

In `Y2Storage` every device is associated to a `ResizeInfo` object:

~~~
@!method resize_ok?
  Whether is possible to resize the device
  @return [Boolean]

@!method min_size
  Minimal size the device can be resized to
  Note this is not aligned.
  @return [DiskSize]

@!method reasons
  Reasons blocking a resize as an array of symbols such
  as :RB_MIN_SIZE_FOR_FILESYSTEM etc.;
  see also FreeInfo.h in libstorage-ng.
  @return [Array<Symbol>]

@!method reason_texts
  Reasons blocking a resize in text form.
  @return [Array<String>]
~~~

Additionally, the objects of the `BlkFilesystem` class offer the following methods:

~~~
#supports_shrink?
#supports_grow?
#supports_resize?
~~~

The latest is obviously just an OR combination of the other two offered for convenience.

### How ResizeInfo works at libstorage-ng

* Apparently, `#resize_ok` is only *false* if both growing and shrinking are impossible. For
  example, if a device cannot be shrunk but can be grown then `#resize_ok` is true.

* There is no equivalent boolean attribute to ask only about shrinking.

* There are 20 so-called reasons to block resize operations:
  * 5 of them block growing but not shrinking.
  * 7 of them block shrinking but not growing.
  * 8 of them block both operations.


### Filesystem info at libstorage-ng

Apart from `ResizeInfo`, *libstorage-ng* offers information about resizing at file system level.
The `BlkFilesystem` objects offer these boolean methods:

~~~
#supports_shrink
#supports_grow
#supports_mounted_shrink
#supports_mounted_grow
#supports_unmounted_shrink
#supports_unmounted_grow
~~~

The methods `#supports_shrink` and `#supports_grow` are used as the main criteria to add the
corresponding reasons `RB_SHRINK_NOT_SUPPORTED_BY_FILESYSTEM` and
`RB_GROW_NOT_SUPPORTED_BY_FILESYSTEM` to `ResizeInfo`.

### What does the *Expert Partitioner* do?

* It discourages to resize devices with no descendants in the *devicegraph*. It cannot be ensured
  whether the device contains something, see [resize_blk_device.rb#L88](https://github.com/yast/yast-storage-ng/blob/0e39eba1e111101ec528d8cc7c4430f66faee764/src/lib/y2partitioner/actions/resize_blk_device.rb#L88).

* It also discourages to resize thin LVM snapshots, see [resize_blk_device.rb#L119](https://github.com/yast/yast-storage-ng/blob/0e39eba1e111101ec528d8cc7c4430f66faee764/src/lib/y2partitioner/actions/resize_blk_device.rb#L119).
  This check looks kind of redundant with a *libstorage-ng* one, but maybe it is not[^1].

* It includes an specific check to forbid resizing devices containing file systems of certain types
  based on `BlkFilesystem#supports_resize?`, see [resize_blk_device.rb#L161](https://github.com/yast/yast-storage-ng/blob/0e39eba1e111101ec528d8cc7c4430f66faee764/src/lib/y2partitioner/actions/resize_blk_device.rb#L142).
  This check may be redundant with the one done by `libstorage-ng` (see above).

* It forbids to resize a device when it’s a component of another device (e.g., LVM or MD RAID). The
  user must delete the LVM/RAID before, see [resize_blk_device.rb#L142](https://github.com/yast/yast-storage-ng/blob/0e39eba1e111101ec528d8cc7c4430f66faee764/src/lib/y2partitioner/actions/resize_blk_device.rb#L142).
  This check is partially redundant with a *libstorage-ng one*[^2].

* It also forbids to resize devices based on `resize_info.resize_ok?`. It displays the reasons
  (`resize_info.reasons`), see [resize_blk_device.rb#L172](https://github.com/yast/yast-storage-ng/blob/0e39eba1e111101ec528d8cc7c4430f66faee764/src/lib/y2partitioner/actions/resize_blk_device.rb#L172).

[^1]: Reading *libstorage-ng* code it could be expected `RB_RESIZE_NOT_SUPPORTED_FOR_LVM_LV_TYPE` to
be reported when trying to resize an LVM thin snapshot. But it does not seem to happen.

[^2]: Reading the description of `RB_RESIZE_NOT_SUPPORTED_BY_DEVICE` it could be
expected that reason applies to all components:
“_The device or one of its descendants that also needs resizing does not support resizing._”.
But it seems that *libstorage-ng* allows growing a partition that is a PV. It does not allow
shrinking it though (see below).

### Shrinking in some special cases

Note: all this refer to devices that are already at disk. Resizing devices that only exist at the
staging *devicegraph* is way more flexible.

* Shrinking a partition that is an LVM PV is not allowed by *libstorage-ng*. That is achieved by
  doing `resize_info.min_size = get_size()`.
* Shrinking partitions that are part of a RAID is not allowed either. `#resize_ok` returns *false*
  with the reason `RB_RESIZE_NOT_SUPPORTED_BY_DEVICE`.

### Additional notes

Looks like in order to check whether an NTFS is resizable it must be unmounted. For the time being,
it can be considered as granted, see [resize_blk_device.rb#L187](https://github.com/yast/yast-storage-ng/blob/0e39eba1e111101ec528d8cc7c4430f66faee764/src/lib/y2partitioner/actions/resize_blk_device.rb#L187).

## Shrinking devices in Agama

*Agama* checks several things to decide whether a partition can be shrunk by the proposal. Each
check is implemented by `Agama::Storage::DeviceShrinking` and, when it fails, it produces a reason
(a symbol, never translated, used for logging, plus a text for the UI):

1. Whether there are descendants in the *devicegraph*. If not, it’s better to not offer resizing
  (is actually more dangerous that it looks). Delete or nothing. Reason: `NO_CONTENT`.
2. Whether the `#resize_info` of the device contains any of the reasons that prevents resizing
  (checking for `#resize_ok?` is not enough). Reasons: the `RB_*` symbols reported by *libstorage-ng*.
3. Whether the minimum size is smaller than the current size. Sometimes *libstorage-ng* sets
  `min == current` as a way to prevent shrinking without really reporting a reason.
  Reason: `NO_MIN_SIZE`.
4. Whether the minimum size is zero. Probably it only happens when there is no descendants.
  Reason: `NO_MIN_SIZE`.

`NO_CONTENT` and `NO_MIN_SIZE` are added by Agama. They are only reported if *libstorage-ng* does not
report any reason by itself. If *libstorage-ng* fails to calculate the resize information, the device
is considered as not shrinkable (`NO_MIN_SIZE`).

### Usage in the proposal

The proposal only shrinks devices that *Agama* considers shrinkable (see above), so the proposal
agrees with the information offered to the user (the `shrinking` section of the devices in the
system and proposal JSON). A resize action for a device that cannot be shrunk is automatically
skipped, instead of leaving the decision to *Y2Storage*. The skip is logged with the device and the
reasons, for example:

```
Skip resizing /dev/vdc6: NO_CONTENT
```

Shrinking is automatically skipped in the following cases:

* **The device has no content (`NO_CONTENT`).** There is nothing in the *devicegraph* below the
  device. This includes devices that are really empty, but also:
  * an encryption layer that is not open (e.g., a locked LUKS), because Agama cannot see what is
    inside;
  * a device with a file system or a storage system that *libstorage-ng* does not know, or any other
    raw data (a disk image, a database, etc.).

  Shrinking only moves the end of the partition. Everything stored after the new end is lost, and
  what remains may become unusable because the file system or storage system inside still expects
  the old size. In the case of an encrypted device, Agama cannot even know how much of it is used.
* **There is no valid minimum size (`NO_MIN_SIZE`).** The minimum size reported by *libstorage-ng* is
  zero or equal to the current size, or it could not be calculated.
* **The device cannot be shrunk (reasons that only block shrinking).**
  * `RB_SHRINK_NOT_SUPPORTED_BY_FILESYSTEM`: the file system does not support shrinking (e.g., XFS).
  * `RB_SHRINK_NOT_SUPPORTED_BY_MULTIDEVICE_FILESYSTEM`: same for a file system over several devices.
  * `RB_MIN_SIZE_FOR_FILESYSTEM`, `RB_MIN_SIZE_FOR_PARTITION`, `RB_MIN_SIZE_FOR_LVM_LV`: the minimum
    size imposed by the file system, the partition or the logical volume prevents shrinking.
  * `RB_SHRINK_NOT_SUPPORTED_FOR_LVM_LV_TYPE`: the type of logical volume cannot be shrunk.
  * `RB_FILESYSTEM_FULL`: the file system is full.
* **The device cannot be resized (reasons that block shrinking and growing).**
  * `RB_RESIZE_NOT_SUPPORTED_BY_DEVICE`: the device does not support resizing (e.g., disks, RAID
    members).
  * `RB_MIN_MAX_ERROR`: the minimum and maximum sizes are inconsistent.
  * `RB_FILESYSTEM_INCONSISTENT`: the file system is inconsistent.
  * `RB_EXTENDED_PARTITION`: the device is an extended partition.
  * `RB_ON_IMPLICIT_PARTITION_TABLE`: the partition is on an implicit partition table.
  * `RB_RESIZE_NOT_SUPPORTED_FOR_LVM_LV_TYPE`: the type of logical volume cannot be resized.
  * `RB_RESIZE_NOT_SUPPORTED_DUE_TO_SNAPSHOTS`: the logical volume has snapshots.
  * `RB_PASSWORD_REQUIRED`: a password is needed to check the device (e.g., encrypted devices).

The list of reasons above has to be kept in sync with `SHRINKING_REASONS`, `RESIZE_REASONS` and
`EXTRA_REASONS` in `Agama::Storage::DeviceShrinking`.

Note that:

* Skipping the shrinking is silent for the user, no issue is reported. This applies to all kind of
  resize actions of such a device, including a mandatory shrinking (a `max` size smaller than the
  current size of the device). The device is left as it is, and the proposal may fail for lack of
  space if the new devices do not fit without shrinking it.
* The skip only affects shrinking. Growing a reused device is not affected.
* When the shrinking is not skipped, the size of the device after the proposal can still be bigger
  than the configured `max`: *Y2Storage* never shrinks a device below the minimum size reported by
  *libstorage-ng*, and it does it silently.

### The influence of reusing devices

The proposal will never delete or resize partitions that are being reused or that are necessary for
a reused device. For example, if an LV is being reused, none of the partitions that are PVs for the
same VG would be deleted or resized, no matter what the space actions say.

It would be good to present that circumstance to the user instead of allowing to select an action
and then ignore it.
