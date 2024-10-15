# Problems with the AutoYaST Storage Schema

The AutoYaST schema is far from ideal and it presents some structural problems. For that reason,
Agama offers its own storage schema following similar principles but a different approach at several
levels.

This document explains some of the problems that caused the AutoYaST schema (or an hypothetical
compatible one) to be discarded as the main schema for Agama.

## Everything Is a Drive or a Partition Section

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

## Directly Formatting Devices is Hammered

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

## Selecting Devices is Difficult and Limited

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

## Devices Are Created in a Indirect Way

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
