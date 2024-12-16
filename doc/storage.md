# Storage considerations

This document describes several aspects of Agama's approach to storage configuration.

All the user-facing information has been moved to the
[repository](https://github.com/agama-project/agama-project.github.io) containing the Agama
documentation. This document is maintained here for the following purposes.

  - Document the rationale behind some design decisions.
  - Recap implementation details or other information that is too technical for user-oriented
    documents.
  - Record aspects that are still under discussion.

## Agama and YaST 

This section describes some of the main differences between the Agama and YaST approaches.

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

### The Initial Proposal

Currently YaST tries really hard to present an initial proposal to the user, even if that implies
several subsequent executions of the `GuidedProposal`, each of them with a less ambitious
configuration. For that it relies on two features of the so-called volumes.

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

![Guided Setup result at YaST](images/storage/yast_guided_result.png)

As mentioned before, Agama doesn't need to replicate all YaST behaviors or to inherit its
requirements and expectations. It's possible to adopt the same approach or to go all the way in the
other direction and try by default to execute the storage proposal only once, with:

  - A single disk as target (chosen by any criteria)
  - The default product strategy for making space (eg. wiping the content of the disk)
  - Using the default settings for all volumes

If that execution of the proposal fails, then Agama could simply show a message like:
"it was not possible to calculate an initial storage layout".

### Reusing LVM Setups

For historical reasons, YaST tries to reuse existing LVM volume groups when making a proposal. That
behavior can be very confusing in many situations. To avoid the associated problems, the Agama
storage proposal will not automatically reuse existing LVM structures.

To reuse existing volume groups the user must explicitly specify that. See the section "future
features".

## Agama and AutoYaST

The relationship between the Agama storage schema and the old AutoYaST format is described
at a [separate document](./autoyast_storage.md).

## Calculating the omitted size of a file system

If the size is omitted for a new device that directly contain a `filesystem` entry with a mount
point, Agama will then use the settings of the product to set the size limits. From a more
technical point of view, that translates into the following:

 - If the mount path corresponds to a volume supporting `auto_size`, that feature will be used.
 - If it corresponds to a volume without `auto_size`, the min and max sizes of the volumes will be
   used.
 - If there is no volume for that mount path, the sizes of the default volume will be used.
 - If the product does not specify a default volume, the behavior is still not defined (there are
   several reasonable options).

## Schema sections under discussion

This section summarizes several aspects of the Agama storage schema that have been considered
but not implemented so far.

### Specifying the Size of a Device

The current schema makes it possible to specify the sizes as a fixed value or as a range. But a
a parseable string like "40 GiB" may not be the only option to represent a size or a range limit.
The following two possibilities are also under consideration.

 - `{ "gib": 40 }`
 - `{ "value": 40, "units": "gib" }`

### Searching Existing Devices

Strings may be used as value for `search` to locate a device by its name or to search all existing
devices using "\*". But strings may be useful in other situations.

For example, "next" (or any similar term) could be used to represent the default search for drives
(which is something like `{ "sort": { "property": "name" }, "max": 1, "ifNotFound": "error" }`.

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

Another aspect under discussion is the format to specify conditions. Instead of the format described
above, it would be possible to use the key as name of the property, resulting in something like this.

```json
{
    "search": {
        "condition": { "sizeGib": 1, "operator": "greater" }
    }
}
```

### Referencing Other Devices

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
