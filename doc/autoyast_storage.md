# Agama and AutoYaST

The AutoYaST schema to specify the storage setup is far from ideal and presents some structural
problems. Although Agama uses its own storage schema, an Agama profile can contain a special
`legacyAutoyastStorage` section which is a 1:1 representation of the XML AutoYaST profile.

## Implementation considerations for the AutoYaST specification

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

## Problems with the AutoYaST storage schema

This section explains some of the problems that caused the AutoYaST schema (or an hypothetical
compatible one) to be discarded as the main schema for Agama.

### Everything is a Drive or a Partition section

This could seem a minor detail, but it has several implications:

* A `<type>` property is required to indicated the type of device (*RAID*, *LVM*, etc).
* Some properties could be meaningless for the selected type.
* Having a `<partitions>` section for describing logical volumes is weird.

~~~xml
<partitioning config:type="list">
  <drive>
    <type config:type="symbol">CT_LVM</type>
    <disklabel>gpt</disklabel> <!-- It does not make sense for a volume group -->
    <partitions config:type="list"> <!-- It really means logical volumes -->
      <partition>
        <partition_id>131</partition_id> <!-- It does not make sense for a logical volume -->
      </partition>
    </partitions>
  </drive>
</partitioning>
~~~

### Directly formatting devices is hammered

A `<partitions>` section is still needed for directly formatting a device, which shows the abuse of
the schema.

~~~xml
<partitioning config:type="list">
  <drive>
    <disklabel>none</disklabel>
    <partitions config:type="list">
      <partition>
        <filesystem config:type="symbol">btrfs</filesystem>
      </partition>
    </partitions>
  </drive>
</partitioning>
~~~

### Selecting devices is difficult and limited

The AutoYaST schema allows selecting specific devices by using the `<skip_list>` property. This
forces to use inverse logic when looking for a device. For example, if you want to select a disk
bigger than 1 GiB, then you have to skip the smaller disks:

~~~xml
<partitioning config:type="list">
  <drive>
    <skip_list config:type="list">
      <!-- skip devices that are smaller than 1GB -->
      <listentry>
        <skip_key>size_k</skip_key>
        <skip_value>1048576</skip_value>
        <skip_if_less_than config:type="boolean">true</skip_if_less_than>
      </listentry>
    </skip_list>
  </drive>
</partitioning>
~~~

The partitions to remove are selected by means of the `<use>` property, which is very limited. It
only allows removing everything, nothing, specific partition numbers or linux partitions.

~~~xml
<partitioning config:type="list">
  <drive>
    <device>/dev/sdc</device>
    <use>2</use> <!-- Removes the partition number 2 -->
    <partitions config:type="list">
      ...
    </partitions>
  </drive>
</partitioning>
~~~

The property `<partition_nr>` is used for reusing a partition. Again, this option is very limited,
allowing selecting a partition only by its number.

~~~xml
<partitioning config:type="list">
  <drive>
    <device>/dev/sdc</device>
    <partitions config:type="list">
      <partition>
        <partition_nr>1</partition_nr> <!-- Reuse the partition number 1 -->
      </partition>
    </partitions>
  </drive>
</partitioning>
~~~

Note that you could indicate the same partition number for deleting (`<use>`) and for reusing (`<partition_nr>`).

### Devices are created in a indirect way

For creating new LVM volume groups, RAIDS, etc, it is necessary to indicate which devices to use as
logical volumes or as RAID members. In AutoYaST, the partitions have to indicate the device they are
going to be used by.

~~~xml
<partitioning config:type="list">
  <drive>
    <device>/dev/sda</device>
    <partitions config:type="list">
      <partition>
        <raid_name>/dev/md/0</raid_name> <!-- Indicate what device is going to use it -->
      </partition>
    </partitions>
  </drive>
  <drive>
    <device>/dev/sdb</device>
    <partitions config:type="list">
      <partition>
        <raid_name>/dev/md/0</raid_name>
      </partition>
    </partitions>
  </drive>
  <drive>
    <device>/dev/md/0</device>
  </drive>
</partitioning>
~~~

It would be more natural to indicate the used devices directly in the RAID or logical volume drive.

### Actions to make space must be very explicit

There is no way to specify optional actions to be performed on the existing devices, like "resize
a given partition as much as needed to make space for the new ones" or "delete a partition only if
necessary" or "grow the existing partition to use the rest of the available space".

### MD RAIDs and LVM Volume Groups must be described exhaustively

To get a volume group on top of partitions distributed across several disks, the profile must
specify the partitions that will serve as physical volumes on each disk, including exact sizes.
That implies that, in order to get fully precise logical volumes, the creator of the profile must
have some knowledge about the overhead in size introduced by each partition and the corresponding
physical volume header and also about all the rounding introduced by the LVM logical volumes.

Something similar happens with MD RAIDs that sit on top of partitions. The sizes are specified at
partition level even if the usable size of the resulting MD RAID may not obvious.

Of course, the problem accumulates when defining an LVM volume group on top of an MD RAID that sits
on top of some partitions. All the sizes may match (including all possible overheads and rounding)
or the result will contain either wasted or surplus space.

## The New Agama storage schema

Agama offers its own storage schema (using a `storage` section instead of the mentioned
`legacyAutoyastStorage`) which is more semantic, comprehensive and flexible than the
AutoYaST one.

The new schema allows:

* To clearly distinguish between different types of devices and their properties.
* To perform more advanced searches for disks, partitions, etc.
* To indicate deleting and resizing on demand.

The Agama schema is used by a new Agama specific proposal. This decouples the algorithm from the
AutoYaST one, making much easier to support new use cases and avoiding backward compatibility with
fringe AutoYaST scenarios. It also supports some features that are not available in the AutoYaST
proposal like deleting or resizing partitions on demand.
