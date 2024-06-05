# Storage Section of the Agama Profile

This document describes Agama's approach to configure storage using a profile for unattended
installation.

## Legacy AutoYaST Specification

The Agama profile can contain either a `storage` section or a `legacyAutoyastStorage` one.

The rest of this document describes the `storage` section.

That `legacyAutoyastStorage` is a 1:1 representation of the XML specification of AutoYaST. No
json validation will be performed for it.

### Implementation Considerations for AutoYaST Specification

In principle, implementing the legacy AutoYaST module is as simple as converting the corresponding
section of the profile into a `Y2Storage::PartitioningSection` object and use 
`Y2Storage::AutoInstProposal` to calculate the result.

But there are some special cases in which AutoYaST fallbacks to read some settings from the YaST
settings or to use some YaST mechanisms. Those cases should be taken into account during the
implementation.

For example, AutoYaST relies on the traditional YaST proposal settings when "auto" is used to
specify the size of a partition or to determine the default list of subvolumes when Btrfs is used.
See also the sections "Automatic Partitioning" and "Guided Partitioning" at the AutoYaST
documentation for situations in which AutoYaST uses the standard YaST `GuidedProposal` as fallback.

## Basic Structure of the Storage Section

A formal specification of the outer level of the `storage` section would look like this.

```
Storage
  drives <Drive[]>
  volumeGroups <VolumeGroup[]>
  mdRaids <MdRaid[]>
  btrfsRaids <BtrfsRaid[]>
  bcacheDevices <BCache[]>
  nfsMounts <NFS[]>
  guided <Guided>
```

Thus, a `storage` section can contain several entries describing how to configure the corresponding
storage devices and an extra entry used to execute the Guided Proposal in top of the scenario
described by the device entries.

Each volume group, RAID, bcache device or NFS share can represent a new logical device to be created
or an existing device from the system to be processed. Entries below `drives` represent devices
that can be used as regular disks. That includes removable and fixed disks, SD cards, DASD or zFCP
devices, iSCSI disks, multipath devices, etc. Those entries always correspond to devices that can be
found at the system, since Agama cannot create that kind of devices.

In fact, a single entry can represent several devices from the system. That is explained in depth at
the section "searching existing devices" of this document.

## Entries for Describing the Devices

The formal specification of the previous section can be extended as we dive into the structure.

```
Drive
  search: [<Search>]
  alias [<string>]
  encrypt [<EncryptAction>]
  format [<FormatAction>]
  mount [<MountAction>]
  ptableType [<string>]
  partitions [<Partition[]>]

VolumeGroup
  search: [<Search>]
  alias [<string>]
  name [<string>]
  peSize [<number>]
  physicalVolumes [<<string|Search>[]>]
  logicalVolumes [<LogicalVolume[]>]
  delete [<boolean=false>]

MdRaid
  search: [<Search>]
  alias [<string>]
  name <string>
  level [<string>]
  chunkSize [<number>]
  devices [<<string|Search>[]>]
  encrypt [<EncryptAction>]
  format [<FormatAction>]
  mount [<MountAction>]
  ptableType [<string>]
  partitions [<Partition[]>]
  delete [<boolean=false>]

BtrfsRaid
  search: [<Search>]
  alias [<string>]
  dataRaidLevel <string>
  metadataRaidLevel <string>
  devices [<<string|Search>[]>]
  label [<string>]
  mkfsOptions [<string[]>]
  [Btrfs]
  delete [<boolean=false>]

NFS
  alias [<string>]
  path [<string>]
  mount [<MountAction>]

Partition
  search: [<Search>]
  alias [<string>]
  id [<string>]
  type [<string>]
  size [<Size>]
  encrypt [EncryptAction]
  format [<FormatAction>]
  mount [<MountAction>]
  delete [<boolean=false>]

LogicalVolume
  search [<Search>]
  alias [<string>]
  name [<string>]
  size [<Size>]
  pool [<boolean>]
  usedPool [<string>]
  stripes [<number>]
  stripSize [<number>]
  encrypt [<EncryptAction>]
  format [<FormatAction>]
  mount [<MountAction>]
  delete [<boolean=false>]

EncryptAction
  method <string>
  key [<string>]
  pdkdf [<string>]
  label [<string>]
  cipher [<string>]
  keySize [<number>]

FormatAction
  filesystem <string|Btrfs>
  label [<string>]
  mkfsOptions [<string[]>]

MountAction
  path <string>
  mountOptions [<string[]>]
  mountBy [<string>]

Btrfs
  subvolumePrefix [<string>]
  subvolumes [<Subvolume[]>]
  snapshots [<boolean=false>]
  quotas [<boolean=false>]

Size <'default'|string|SizeRange>

SizeRange
  min <string>
  max <string>
```

To illustrate how all that fits together, let's see the following example in which the first disk of
the system is partitioned and a volume group is created on top of that partition (after encrypting
it) to allocate two file systems.

```json
"storage": {
    "drives": [
        {
            "partitions": [
                { 
                    "alias": "pv",
                    "id": "lvm",
                    "size": { "min": "12 GiB" },
                    "encrypt": {
                        "method": "luks2",
                        "key": "my secret passphrase"
                    }
                }
              ]
        }
    ],
    "volumeGroups": [
        {
            "name": "system",
            "physicalVolumes": [ "pv" ],
            "logicalVolumes": [
                {
                    "size":   { "min": "10 GiB" },
                    "format": { "filesystem": "btrfs" },
                    "mount":  { "path": "/" }
                },
                {
                    "size":   "2 GiB",
                    "format": { "filesystem": "swap" },
                    "mount":  { "path": "swap" }
                }
            ]
        }
    ]
}
```

## Specifying the Size of a Device

When creating some kinds of devices or resizing existing ones (if possible) it may be necessary to
specify the desired size. As seen in the specification above, that can be done in several ways.

The most straightforward one is just using a string that can be parsed into a valid size.

The second option is to provide a minimum size and an optional maximum one. The resulting size will
be between those thresholds. If the maximum is omitted or set to `null`, the device will grow as
much as possible, taking into account the available spaces and all the other specified sizes.

The third option is to use the string "default". That means Agama will decide the size based on the
mount point and the settings of the product. From a more technical point of view, that translates
into the following:

 - If the mount path corresponds to a volume supporting `auto_size`, that feature will be used.
 - If it corresponds to a volume without `auto_size`, the min and max sizes of the volumes will be
   used.
 - If there is no volume for that mount path, the sizes of the default volume will be used.
 - If the product does not specify a default volume, the behavior is still not defined (there are
   several reasonable options).

### Under Discussion

As explained, it should be possible to specify the sizes as "default", as a range or as a fixed
value. But in the last two cases, a parseable string like "40 GiB" may not be the only option to
represent a size. The following two possibilities are also under consideration.

 - `{ "gib": 40 }`
 - `{ "value": 40, "units": "gib" }`

## Searching Existing Devices

Many sections in the profile are used to describe how some devices must be created, modified or even
deleted. In the last two cases, it's important to match the description with one or more devices
from the system.

If a description matches several devices, the same operations will be applied to
all. That's useful in several situations like applying the same partitioning schema to several disks
or deleting all partitions of a disk that match a given criteria.

Matching is performed using a `search` subsection. The format is still under heavy discussion but
may look similar to this.

```
Search
  condition [<Condition>]
  sort [<Sort>]
  max [<number>]
  ifNotFound [<NotFoundAction='skip'>]

Condition <Rule|OperatorAnd|OperatorOr>

OperatorAnd
  and: <Condition[]>

OperatorOr
  or: <Condition[]>

Rule
  property <string>
  value <any>
  operator [<Operator='equal'>]

Operator <'equal'|'notEqual'|'less'|'greater'|'lessOrEqual'|'greaterOrEqual'>

Sort
  property <string>
  order <'asc'|'desc'>

NotFoundAction <'create'|'skip'|'error'>
```

By default, all devices in the scope fitting the conditions will be matched. The number of device
matches can be limited using `max`. The following example shows how several `search` sections could
be used to find the three biggest disks in the system, delete all linux partitions bigger than 1 GiB
within them and create new partitions of type RAID.

```json
"storage": {
    "drives": [
        {
            "search": {
                "sort": { "property": "sizeKib", "order": "desc" },
                "max": 3
            },
            "partitions": [
                {
                    "search": {
                        "condition": {
                            "and": [
                                { "property": "id", "value": "linux" },
                                { "property": "sizeGib", "value": 1, "operator": "greater" }
                            ]
                        }
                    },
                    "delete": true
                },
                { 
                    "alias": "newRaidPart",
                    "id": "raid",
                    "size": { "min": "1 GiB" }
                }
              ]
        }
    ]
}
```

The example also serves to illustrate the scope of each search. That is, the devices from the system
that are considered as possible candidates. That obviously depends on the place in the profile of
the `search` section.  A `search` section inside the description of an MD RAID will only match MD
devices and a `search` section inside the `partitions` subsection of that RAID description will only
match partitions of RAIDs that have matched the conditions of the most external `search`.

A given device can never match two different sections of the Agama profile. When several sections
at the same level contain a search subsection, devices are matched in the order the sections appear
on the profile.

```json
"storage": {
    "drives": [
        {
            "search": {
                "sort": { "property": "sizeKib", "order": "desc" },
                "max": 1
            },
            "alias": "biggest"
        },
        {
            "search": {
                "sort": { "property": "sizeKib", "order": "desc" },
                "max": 1
            },
            "alias": "secondBiggest"
        }
    ]
}
```

An empty search will match all devices in the scope, so the following example would delete all the
partitions of the chosen disk.

```json
"storage": {
    "drives": [
        {
            "partitions":
                { "search": {}, "delete": true }
        }
     ]
}
```

If there is not a single system device matching the scope and the conditions of a given search, then
`ifNotFound` comes into play. If the value is "skip", the device definition is ignored. If it's
"error" the whole process is aborted. The value "create", which cannot be used for a drive, will
cause the `search` section to be ignored if no device matches. As a consequence, a new logical
device (partition, LVM, etc.) will be created.

Entries on `drives` are different to all other subsections describing devices because drives can
only be matched to existing devices, they cannot be simply created. If `search` is omitted for a
drive, it will be considered to contain the following one.

```json
{
    "search": {
        "sort": { "property": "name" },
        "max": 1,
        "ifNotFound": "error"
    }
}
```

### Under Discussion

Very often, `search` will be used to find a device by its name. In that case, the syntax could be
simplified to just contain the device name as string.

```json
{ "search": "/dev/sda" }
```

Using a string as value for `search` may also be useful in other situations. Special values could be
used as aliases for typical cases:

  - Empty string or "\*" to match all devices (the same than an empty section)
  - Something like "next" to represent the default search for drives (see above)

If a simple string like "next" could be used to specify the standard search entry for drives, it
would make sense to simply make `search` mandatory for all drives instead of assuming a default one.

Another possible improvement for that string-based format would be supporting regular expressions.
That would make it possible to use searchers like this.

```json
{ "search": ".*" }
```

But regular expressions would not play well with libstorage-ng. Since not all device names are
stored in the devicegraph, it is is necessary to use functions like `find_by_any_name` in order to
perform an exhaustive search by name.

Another apect under discussion is the format to specify conditions. Instead of the format described
above, it would be possible to use the key as name of the property, resulting in something like this.

```json
{
    "search": {
        "condition": { "sizeGib": 1, "operator": "greater" }
    }
}
```

## Referencing Other Devices

Sometimes is necessary to reference other devices as part of the specification of an LVM volume
group or RAID. Those can be existing system devices or devices that will be created as response to
another entry of the Agama profile.

Aliases can be used for that purpose as shown in this example.

```json
"storage": {
    "drives": [
        {
            "partitions":
                { "size": "50 GiB", "id": "lvm", "alias": "newPV" }
        }
     ],
     "volumeGroups": [
        {
            "name": "newVG",
            "physicalVolumes": [ "newPV" ],
            "logicalVolumes": [ { "name": "data", "size": "20 GiB" } ]
        }
    ]
}
```

If a section that matches several existing devices contains an alias, that alias will be considered
to be a reference to all the devices. As a consequence, this two examples are equivalent.

```json
"storage": {
    "drives": [
        {
            "search": {
                "sort": { "property": "sizeKib", "order": "desc" },
                "max": 1,
            },
            "alias": "biggest"
        },
        {
            "search": {
                "sort": { "property": "sizeKib", "order": "desc" },
                "max": 1,
            },
            "alias": "secondBiggest"
        }
    ],
    "mdRaids": [
        {
            "devices": [ "biggest", "secondBiggest" ],
            "level": "raid0"
        }
    ]
}

"storage": {
    "drives": [
        {
            "search": {
                "sort": { "property": "sizeKib", "order": "desc" },
                "max": 2,
                "min": 2
            },
            "alias": "big"
        }
    ],
    "mdRaids": [
        {
            "devices": [ "big" ],
            "level": "raid0"
        }
    ]
}
```

### Under Discussion

In addition to aliases, a `search` section could be accepted in all the places in which an alias can
be used. In that case, the scope of the search would always be the whole set of devices in the
system (so the same conditions can be matched by a disk, a partition, an LVM device, etc.) and
`ifNotFound` could not be set to "create" (similar to what happens for drives in general).

```json
"storage": {
     "volume_groups": [
        {
            "name": "newVG",
            "physicalVolumes": [
                { "search": { "condition": { "property": "name", "value": "/dev/sda2" } } }
            ],
            "logicalVolumes": [ { "name": "data", "size": "20 GiB" } ]
        }
    ]
}
```

## Partitions needed for Booting

When relying on the Agama proposal (see below), there are some options to configure whether (and
where) Agama should calculate and create the extra partitions needed for booting.

If the proposal is not used, Agama will always try to calculate and create those partitions taking
the location of the root file system as a reference. That's the same approach that AutoYaST has
followed for years.

## Using the Automatic Proposal

Agama can rely on the process known as Guided Proposal to calculate all the needed partitions, LVM
devices and file systems based on some general product settings and some user preferences. That
mechanism can also be used as part of the profile and will be executed as a last step, after
processing all the explicit sections that describe devices.

The `guided` section conforms to the following specification.

```
Guided
  device [TargetDevice]
  boot [BootSettings]
  encryption [EncryptionSettings]
  space <'delete'|'resize'|'keep'>
  volumes [Volume[]]

TargetDevice <string|TargetDisk|TargetNewLvm|TargetReusedLvm>

TargetDisk
  disk <string|Search>
 
TargetNewLvm
  newLvmVg <<string|Search>[]>

TargetReusedLvm
  reusedLvmVg <string|Search>

BootSettings
  configure <boolean>
  device <string|Search>

EncryptionSettings
  password <string>
  method <string>
  pbkdFunction <string>

Volume
  mountPath <string>
  mountOptions <string>
  filesystem <string>
  autoSize <boolean>
  minSize <string>
  maxSize <string>
  snapshots <Boolean>
  target <VolumeTarget>

VolumeTarget <'default'|NewPartition|NewVg|UseDevice|UseFilesystem>

NewPartition
  newPartition <string|Search>
  
NewVg
  newVg <string|Search>
  
UseDevice
  device <string|Search>

UseFilesystem
  filesystem <string|Search>
```

The `device` can be specified in several ways. The simplest one is using one of the strings "disk"
or "newLvmVg". In that case, the proposal will automatically select the first disk to be used as
target disk or as base to create the physical volumes. For example, this will create a default
partition-based installation on the first available disk.

```json
"storage": {
    "guided": { "device": "disk" }
}
```

And this will do the same, but creating a new LVM volume group on that first candidate disk.

```json
"storage": {
    "guided": { "device": "newLvmVg" }
}
```

It's also possible to use an alias to specify a concrete disk...

```json
"storage": {
    "drives": [
        { "alias": "target" }
    ],
    "guided": {
        "device": {
            "disk": "target"
        }
    }
}
```

or to specify the set of disks where the LVM physical volumes can be created.

```json
"storage": {
    "drives": [
        {
            "alias": "nvme",
            "search": { "condition": { "property": "driver", "value": "nvme" } }
        }
    ],
    "guided": {
        "device": {
            "newLvmVg": ["nvme"]
        }
    }
}
```

The alias can correspond to devices that are created by Agama itself.

```json
"storage": {
    "mdRaids": [
        {
            "alias": "newMd"
            "devices": [ "..." ],
            "level": "raid1"
        }
    ],
    "guided": {
        "device": { "disk": "newMd" }
    }
}
```

Apart from specifying the main target device, aliases can be used wherever a device is expected, eg.
when indicating a special target for a given volume.

In principle, the list of volumes will have the same format than the existing HTTP API used by
the UI for calculating the storage proposal. That is, if the list is not provided the default
volumes will be created and if some aspects are omitted for a given volume they will be completed
with default values. In the future we may consider more advanced mechanisms to include or exclude
some given volumes or to customize a single volume without having to provide the full list of
volume mount paths.

Combining the `guided` section with other possible sections in the profile makes it possible to
achieve the same results than using the Agama user interface with only one exception. The Agama UI
allows to indicate that a given set of partitions can be resized if needed to allocate the volumes,
without actually indicating how much those partitions should be resized. The Guided Proposal
algorithm decides whether to resize and how much based on the other settings. Currently there is no
way to express that in the auto-installation profile.

### Under Discussion

It could also be possible to accept a `search` element in all places in which an alias can be used.

```json
"storage": {
    "guided": {
        "device": {
            "newLvmVg": [
                { "search": { "condition": { "property": "driver", "value": "nvme" } } }
            ]
        }
    }
}
```

Even combining that with the string-based syntax suggested for `search`.

```json
"storage": {
    "guided": {
        "device": {
            "disk": { "search": "/dev/sda" }
        }
    }
}
```
