# Storage Section of the Agama Profile

This document describes Agama's approach to configure storage using a profile for unattended
installation.

## Agama and AutoYaST

The Agama profile has a special `legacyAutoyastStorage` section which is a 1:1 representation of the
XML AutoYaST profile. This section supports everything offered by the *partitioning* AutoYaST
section. Note that Agama does not validate this special section, so be careful to provide valid
AutoYaST options.

~~~json
{
  "legacyAutoyastStorage": [
    {
      "use": "all",
      "partitions": []
    }
  ]
}
~~~

Although that special section is offered for backwards compatibility and to ease gradual migration
from AutoYaST to Agama, there are no plans to introduce any improvement or new feature in the legacy
mode due to the [intrinsic limitations](./autoyast_storage.md) of the original AutoYaST schema.

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

## The New Storage Schema

Agama offers its own storage schema which is more semantic, comprehensive and flexible than the
AutoYaST one.

The new schema allows:

* To clearly distinguish between different types of devices and their properties.
* To perform more advanced searches for disks, partitions, etc.
* To indicate deleting and resizing on demand.

The Agama schema is used by a new Agama specific proposal. This decouples the algorithm from the
AutoYaST one, making much easier to support new use cases and avoiding backward compatibility with
fringe AutoYaST scenarios. It also supports some features that are not available in the AutoYaST
proposal like deleting or resizing partitions on demand.

### Basic Structure of the Storage Section

A formal specification of the outer level of the `storage` section would look like this.

```
Storage
  drives <Drive[]>
  volumeGroups <VolumeGroup[]>
  mdRaids <MdRaid[]>
  btrfsRaids <BtrfsRaid[]>
  nfsMounts <NFS[]>
  boot [BootSettings]
  encryption [EncryptionSettings]
```

Thus, a `storage` section can contain several entries describing how to configure the corresponding
storage devices and a couple of extra entries to setup some general aspects that influence the final
layout.

Each volume group, RAID, bcache device or NFS share can represent a new logical device to be created
or an existing device from the system to be processed. Entries below `drives` represent devices
that can be used as regular disks. That includes removable and fixed disks, SD cards, DASD or zFCP
devices, iSCSI disks, multipath devices, etc. Those entries always correspond to devices that can be
found at the system, since Agama cannot create that kind of devices.

In fact, a single entry can represent several devices from the system. That is explained in depth at
the section "searching existing devices" of this document.

On the first versions of Agama, an alternative syntax will be accepted including only one `guided`
entry.

```
Storage
  guided <Guided>
```

That allows to rely on the YaST component known as `GuidedProposal`. That alternative will be
removed as soon as all the capabilities of that `GuidedProposal` could be expressed in terms of a
regular storage configuration like the one explained above.

### Entries for Describing the Devices

The formal specification of the previous section can be extended as we dive into the structure.

```
Drive
  search [<Search>]
  alias [<string>]
  encryption [<Encryption>]
  filesystem [<Filesystem>]
  ptableType [<string>]
  partitions [<Partition[]>]

VolumeGroup
  search [<Search>]
  alias [<string>]
  name [<string>]
  peSize [<number>]
  physicalVolumes [<string|Search>[]>]
  logicalVolumes [<LogicalVolume[]>]
  delete [<boolean=false>]

MdRaid
  search [<Search>]
  alias [<string>]
  name <string>
  level [<string>]
  chunkSize [<number>]
  devices [<<string|Search>[]>]
  size [<Size>]
  encryption [<Encryption>]
  filesystem [Filesystem]
  ptableType [<string>]
  partitions [<Partition[]>]
  delete [<boolean=false>]

BtrfsRaid
  search [<Search>]
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
  search [<Search>]
  alias [<string>]
  id [<string>]
  size [<Size>]
  encryption [Encryption]
  filesystem [<Filesystem>]
  delete [<boolean=false>]
  deleteIfNeeded [<boolean=false>]

LogicalVolume
  search [<Search>]
  alias [<string>]
  name [<string>]
  size [<Size>]
  pool [<boolean>]
  usedPool [<string>]
  stripes [<number>]
  stripSize [<number>]
  encryption [Encryption]
  filesystem [<Filesystem>]
  delete [<boolean=false>]
  deleteIfNeeded [<boolean=false>]
Encryption
  reuse <Boolean>
  type <EncryptionType>

EncryptionType <EncryptionLUKS1|EncryptionLUKS2|EncryptionPervasiveLUKS2|"protected_swap"|"secure_swap"|"random_swap">

EncryptionLUKS1
  password <string>
  keySize [<number>]
  cipher [<string>]

EncryptionLUKS2
  password <string>
  keySize [<number>]
  cipher [<string>]
  pdkdf [<string>]
  label [<string>]

EncryptionPervasiveLUKS2
  password <string>

Filesystem
  reuse <Boolean>
  type <string|Btrfs>
  label [<string>]
  mkfsOptions [<string[]>]
  path <string>
  mountOptions [<string[]>]
  mountBy [<string>]

Btrfs
  subvolumePrefix [<string>]
  subvolumes [<Subvolume[]>]
  snapshots [<boolean=false>]
  quotas [<boolean=false>]

Size <string|SizeRange>

SizeRange
  min <string>
  max <string>

BootSettings
  configure <boolean>
  device <string>

EncryptionSettings
  method <string>
  key [<string>]
  pdkdf [<string>]
  cipher [<string>]
  keySize [<number>]
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
                    "encryption": {
                        "luks2": { "password": "my secret passphrase" }
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
                    "filesystem": { "path": "/", "type": "btrfs" }
                },
                {
                    "size":   "2 GiB",
                    "filesystem": { "path": "swap", "type": "swap" }
                }
            ]
        }
    ]
}
```

### Specifying the Size of a Device

When creating some kinds of devices or resizing existing ones (if possible) it may be necessary to
specify the desired size. As seen in the specification above, that can be done in several ways.

The most straightforward one is just using a string that can be parsed into a valid size.

The second option is to provide a minimum size and an optional maximum one. The resulting size will
be between those thresholds. If the maximum is omitted or set to `null`, the device will grow as
much as possible, taking into account the available spaces and all the other specified sizes.

It is also possible to specify "current" as a minimum or maximum size limit for partitions and
logical volumes that already exist in the system (so "current" can only be used for device
specifications that contain a `search` section). The usage of "current" and how it affects
resizing the corresponding devices is explained at a separate section below.

If the size is completely omitted for a device that already exists (ie. combined with `search`),
then Agama would act as if both min and max limits would have been set to "current" (which implies
the partition or logical volume will not be resized).

Moreover, if the size is omitted for a device that will be created, Agama will determine the size
limits when possible. There are basically two kinds of situations in which that automatic size
calculation can be performed.

On the one hand, the device may directly contain a `filesystem` entry specifying a mount point.
Agama will then use the settings of the product to set the size limits. From a more technical point
of view, that translates into the following:

 - If the mount path corresponds to a volume supporting `auto_size`, that feature will be used.
 - If it corresponds to a volume without `auto_size`, the min and max sizes of the volumes will be
   used.
 - If there is no volume for that mount path, the sizes of the default volume will be used.
 - If the product does not specify a default volume, the behavior is still not defined (there are
   several reasonable options).

On the other hand, the size limits of some devices can be omitted if they can be inferred from other
related devices following some rules.

 - For an MD RAID defined on top of new partitions, it is possible to specify the size of all the
   partitions that will become members of the RAID but is also possible to specify the desired size
   for the resulting MD RAID and then the size limits of each partition will be automatically
   inferred with a small margin of error of a few MiBs.
 - Something similar happens with a partition that acts as the **only** physical volume of a new LVM
   volume group. Specifying the sizes of the logical volumes could be enough, the size limits of the
   underlying partition will match the necessary values to make the logical volumes fit. In this
   case the calculated partition size is fully accurate.
 - The two previous scenarios can be combined. For a new MD RAID that acts as the **only** physical
   volume of a new LVM volume group, the sizes of the logical volumes can be used to precisely
   determine what should be the size of the MD and, based on that, what should be the almost
   exact size of the underlying new partitions defined to act as members of the RAID.

The two described mechanisms to automatically determine size limits can be combined. Even creating
a configuration with no explicit sizes at all like the following example.

```json
"storage": {
    "drives": [
        {
            "partitions": [
                { "alias": "pv" }
              ]
        }
    ],
    "volumeGroups": [
        {
            "name": "system",
            "physicalVolumes": [ "pv" ],
            "logicalVolumes": [
                { "filesystem": { "path": "/" } },
                { "filesystem": { "path": "swap" } }
            ]
        }
    ]
}
```

Assuming the product configuration specifies a root filesystem with a minimum size of 5 GiB and a
max of 20 GiB and sets that the swap must have a size equivalent to the RAM on the system, then
those values would be applied to the logical volumes and the partition with alias "pv" would be
sized accordingly, taking into account all the overheads and roundings introduced by the different
technologies like LVM or the used partition table type.

#### Under Discussion

As explained, it should be possible to specify the sizes as a fixed value or as a range. But a
a parseable string like "40 GiB" may not be the only option to represent a size or a range limit.
The following two possibilities are also under consideration.

 - `{ "gib": 40 }`
 - `{ "value": 40, "units": "gib" }`

### Partitions Needed for Booting

Using a `boot` entry makes it possible to configure whether (and where, using an alias) Agama
should calculate and create the extra partitions needed for booting. If the device is not
specified, Agama will take the location of the root file system as a reference.

### Searching Existing Devices

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

#### Under Discussion

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

### Referencing Other Devices

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

#### Under Discussion

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

### Keeping an Existing File System or Encryption Layer

The entries for both `encryption` and `filesystem` contain a flag `reuse` with a default value of
false. It can be used in combination with `search` to specify the device must not be re-encrypted
or re-formatted.

### Deleting and Shrinking Existing Devices

The storage proposal must make possible to define what to do with existing partitions and logical
volumes. Even with existing MD RAIDs or LVM volume groups.

A `search` section allows to match the definition of a partition or an LVM logical volume with one
(or several) devices existing in the system. In order to provide the same capabilities than the
Guided proposal (see below) it must be possible to specify that a given partition or volume must be:

  - Deleted if needed to make space for the newly defined devices
  - Deleted in all cases
  - Shrunk to the necessary size to make space for new devices
  - Shrunk or extended to a given size, maybe a range (not really possible in the current Guided
    Proposal)

It is even possible to express some combinations of the above, like "try to shrink it to make space
but proceed to delete it if shrinking it is not enough".

Deletion can be achieved with the corresponding `delete` flag or the alternative `deleteIfNeeded`.
If any of those flags are active for a partition, it makes no sense to specify any other usage
(like declaring a file system on it).

The following example deletes the partition with the label "root" in all cases and, if needed, keeps
deleting other partitions as needed to make space for the new partition of 30 GiB.

```json
"storage": {
    "drives": [
        {
            "partitions": [
                {
                    "search": {
                        "condition": { "property": "fsLabel", "value": "root" }
                    },
                    "delete": true
                },
                { "search": {}, "deleteIfNeeded": true },
                { "size": "30 GiB" }
            ]
        }
    ]
}
```

Often some partitions or logical volumes are shrunk only to make space for the declared devices. But
since resizing is not a destructive operation, it can also make sense to declare a given partition
must be resized (shrunk or extended) and then formatted and/or mounted.

In any case, note that resizing a partition can be limited depending on its content, the filesystem
type, etc.

Combining `search` and `resize` is enough to indicate Agama is expected to resize a given partition
if possible. The keyword "current" can be used as min and/or max for the size range and it is always
equivalent to the exact original size of the device. The simplest way to use "current" is to just
specify that the matched device should keep its original size. That's the default for searched (and
found) devices if `size` is completely omitted.

```json
"storage": {
    "drives": [
        {
            "partitions": [
                {
                    "search": {
                        "condition": { "property": "fsLabel", "value": "reuse" }
                    },
                    "size": { "min": "current", "max": "current" }
                }
            ]
        }
    ]
}
```

Other combinations can be used to specify how a device could be resized if possible. See the
following examples with explanatory filesystem labels.

```json
"storage": {
    "drives": [
        {
            "partitions": [
                {
                    "search": {
                        "condition": { "property": "fsLabel", "value": "shrinkIfNeeded" }
                    },
                    "size": { "min": 0, "max": "current" }
                },
                {
                    "search": {
                        "condition": { "property": "fsLabel", "value": "resizeToFixedSize" }
                    },
                    "size": "15 GiB"
                },
                {
                    "search": {
                        "condition": { "property": "fsLabel", "value": "resizeByRange" }
                    },
                    "size": { "min": "10 GiB", "max": "50 GiB" }
                },
                {
                    "search": {
                        "condition": { "property": "fsLabel", "value": "growAsMuchAsPossible" }
                    },
                    "size": { "min": "current" }
                },
            ]
        }
    ]
}
```

Of course, when the size limits are specified as a combination of "current" and a fixed value, the
user must still make sure that the resulting min is not bigger than the resulting max.

Both `deleteIfNeeded` and a size range can be combined to indicate that Agama should try to make
space first by shrinking the partitions and deleting them only if shrinking is not enough.

```json
"storage": {
    "drives": [
        {
            "partitions": [
                {
                    "search": {},
                    "size": { "min": 0, "max": "current" },
                    "deleteIfNeeded": true
                }
            ]
        }
    ]
}
```

### Generating Partitions as MD RAID members

MD arrays can be configured to explicitly use a set of devices by adding their aliases to the
`devices` property.

```json
"storage": {
  "drives": [
    {
      "search": "/dev/sda",
      "partitions": [
        { "alias": "sda-40", "size": "40 GiB" }
      ]
    },
    {
      "search": "/dev/sdb",
      "partitions": [
        { "alias": "sdb-40", "size": "40 GiB" }
      ]
    }
  ],
  "mdRaids": [
    {
      "devices": [ "sda-40", "sdb-40" ],
      "level": "raid0"
    }
  ]
}
```

The partitions acting as members can be automatically generated by simply indicating the target
disks that will hold the partitions. For that, the `devices` section must contain a `generate`
entry.

```json
"storage": {
  "drives": [
    { "search": "/dev/sda", "alias": "sda" },
    { "search": "/dev/sdb", "alias": "sdb" },
  ],
  "mdRaids": [
    {
      "devices": [
        {
          "generate": {
            "targetDisks": ["sda", "sdb" ],
            "size": "40 GiB"
          }
        }
      ]
      "level": "raid0"
    }
  ]
}
```

As explained at the section about sizes, it's also possible to set the size for the new RAID letting
Agama calculate the corresponding sizes of the partitions used as members. That allows to use the
short syntax for `generate`.

```json
"storage": {
  "drives": [
    { "search": "/dev/sda", "alias": "sda" },
    { "search": "/dev/sdb", "alias": "sdb" },
  ],
  "mdRaids": [
    {
      "devices": [ { "generate": ["sda", "sdb" ] } ],
      "level": "raid0",
      "size": "40 GiB"
    }
  ]
}
```

### Generating Default Volumes

Every product provides a configuration which defines the storage volumes (e.g., feasible file
systems for root, default partitions to create, etc). The default or mandatory product volumes can
be automatically generated by using a *generate* section in the *partitions* or *logicalVolumes*
sections.

```json
"storage": {
  "drives": [
    {
      "partitions": [
        { "generate": "default" }
      ]
    }
  ]
}

```

The *generate* section allows creating the product volumes without explicitly writing all of them.
The config above would be equivalent to something like this:

```json
"storage": {
  "drives": [
    {
      "partitions": [
        { "filesystem": { "path": "/" } },
        { "filesystem": { "path": "/home" } },
        { "filesystem": { "path": "swap" } }
      ]
    }
  ]
}

```

If any path is explicitly defined, then the *generate* section will not generate a volume for it.
For example, with the following config only root and swap would be automatically added:

```json
"storage": {
  "drives": [
    {
      "partitions": [
        { "generate": "default" },
        { "filesystem": { "path": "/home" } }
      ]
    }
  ]
}
```

The auto-generated volumes can be also configured. For example, for encrypting the partitions:

```json
"storage": {
  "drives": [
    {
      "partitions": [
        {
          "generate": {
            "partitions": "default",
            "encryption": {
              "luks1": { "password": "12345" }
            }
          }
        }
      ]
    }
  ]
}
```

The *mandatory* keyword can be used for only generating the mandatory partitions or logical volumes:

```json
"storage": {
  "volumeGroups": [
    {
      "name": "system",
      "logicalVolumes": [
        { "generate": "mandatory" }
      ]
    }
  ]
}
```

The *default* and *mandatory* keywords can also be used to generate a set of formatted MD arrays.
Assuming the default volumes are "/", "/home" and "swap", the following snippet would generate three
RAIDs of the appropriate sizes and the corresponding six partitions needed to support them.

```json
"storage": {
  "drives": [
    { "search": "/dev/sda", "alias": "sda" },
    { "search": "/dev/sdb", "alias": "sdb" },
  ],
  "mdRaids": [
    {
      "generate": {
        "mdRaids": "default",
        "level": "raid0",
        "devices": [
          { "generate": ["sda", "sdb"] }
        ]
      }
    }
  ]
}
```

### Generating Physical Volumes

Volume groups can be configured to explicitly use a set of devices as physical volumes. The aliases
of the devices to use are added to the list of physical volumes:

```json
"storage": {
  "drives": [
    {
      "search": "/dev/vda",
      "partitions": [
        { "alias": "pv2", "size": "100 GiB" },
        { "alias": "pv1", "size": "20 GiB" }
      ]
    }
  ],
  "volumeGroups": [
    {
      "name": "system",
      "physicalVolumes": ["pv1", "pv2"]
    }
  ]
}
```

The physical volumes can be automatically generated too, by simply indicating the target devices in
which to create the partitions. For that, a *generate* section is added to the list of physical
volumes:

```json
"storage": {
  "drives": [
    {
      "search": "/dev/vda",
      "alias": "pvs-disk"
    }
  ],
  "volumeGroups": [
    {
      "name": "system",
      "physicalVolumes": [
        { "generate": ["pvs-disk"] }
      ]
    }
  ]
}
```

If the auto-generated physical volumes have to be encrypted, then the encryption config is added to
the *generate* section:


```json
"storage": {
  "drives": [
    {
      "search": "/dev/vda",
      "alias": "pvs-disk"
    }
  ],
  "volumeGroups": [
    {
      "name": "system",
      "physicalVolumes": [
        {
          "generate": {
            "targetDevices": ["pvs-disk"],
            "encryption": {
              "luks2": { "password": "12345" }
            }
          }
        }
      ]
    }
  ]
}
```

### Using the Automatic Proposal

On the first implementations, Agama can rely on the process known as Guided Proposal to calculate
all the needed partitions, LVM devices and file systems based on some general product settings and
some user preferences. That mechanism is offered as a temporary alternative to the more descriptive
syntax explained at previous sections of this document and it's implemented via a `guided` section
that conforms to the following specification.

```
Guided
  device [TargetDevice]
  boot [BootSettings]
  encryption [EncryptionSettings]
  space <'delete'|'resize'|'keep'>
  volumes [Volume[]]

TargetDevice <string|TargetDisk|TargetNewLvm|TargetReusedLvm>

TargetDisk
  disk <string>

TargetNewLvm
  newLvmVg <string[]>

TargetReusedLvm
  reusedLvmVg <string>

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
  newPartition <string>

NewVg
  newVg <string>

UseDevice
  device <string>

UseFilesystem
  filesystem <string>
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

It's also possible to use a device name to specify a concrete disk...

```json
"storage": {
    "guided": {
        "device": {
            "disk": "/dev/sda"
        }
    }
}
```

or to specify the set of disks where the LVM physical volumes can be created.

```json
"storage": {
    "guided": {
        "device": {
            "newLvmVg": ["/dev/vda", "/dev/vdb"]
        }
    }
}
```

Apart from specifying the main target device, device names must be used wherever a device is
expected, eg. when indicating a special target for a given volume.

In principle, the list of volumes will have the same format than the existing HTTP API used by
the UI for calculating the storage proposal. That is, if the list is not provided the default
volumes will be created and if some aspects are omitted for a given volume they will be completed
with default values. In the future we may consider more advanced mechanisms to include or exclude
some given volumes or to customize a single volume without having to provide the full list of
volume mount paths.

The `guided` section makes it possible to achieve the same results than using the Agama user
interface with only one exception. The Agama UI allows to indicate that a given set of partitions
can be resized if needed to allocate the volumes, without actually indicating how much those
partitions should be resized. The Guided Proposal algorithm decides whether to resize and how much
based on the other settings. Currently there is no way to express that in the auto-installation
profile.
