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

*Agama* checks several things to decide whether a partition can be shrunk by the proposal:

1. Whether there are descendants in the *devicegraph*. If not, it’s better to not offer resizing
  (is actually more dangerous that it looks). Delete or nothing.
2. Whether the `#resize_info` of the device contains any of the reasons that prevents resizing
  (checking for `#resize_ok?` is not enough).
3. Whether the minimum size is smaller than the current size. Sometimes *libstorage-ng* sets
  `min == current` as a way to prevent shrinking without really reporting a reason.
4. Whether the minimum size is zero. Probably it only happens when there is no descendants.

### The influence of reusing devices

The proposal will never delete or resize partitions that are being reused or that are necessary for
a reused device. For example, if an LV is being reused, none of the partitions that are PVs for the
same VG would be deleted or resized, no matter what the space actions say.

It would be good to present that circumstance to the user instead of allowing to select an action
and then ignore it.
