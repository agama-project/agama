# Copyright (c) [2015-2017] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "yaml"
require "storage"
require "y2storage"

module Y2Storage
  # Class to write storage device trees to YAML files.
  #
  # FIXME: This class exceeds the maximum allowed length (250 lines of code).
  # Reconsider improve it.
  #
  # rubocop:disable Metrics/ClassLength
  class YamlWriter
    include Yast::Logger

    # @return [Boolean] whether to record passwords (default: true)
    attr_accessor :record_passwords

    def initialize
      @record_passwords = true
    end

    class << self
      #
      # Write all devices from the specified devicegraph to a YAML file.
      #
      # This is a singleton method for convenience. It creates a YamlWriter
      # internally for one-time usage. If you use this more often (for
      # example, in a loop), it is recommended to create a YamlWriter and
      # use its write() method repeatedly.
      #
      # @param devicegraph [Devicegraph]
      # @param yaml_file [String | IO]
      # @param record_passwords [Boolean] enable recording passwords
      #
      def write(devicegraph, yaml_file, record_passwords: true)
        writer = YamlWriter.new
        writer.record_passwords = record_passwords
        writer.write(devicegraph, yaml_file)
      end
    end

    # Write all devices from the specified device graph to a YAML file.
    #
    # @param devicegraph [Devicegraph]
    # @param yaml_file [String | IO]
    #
    def write(devicegraph, yaml_file)
      device_tree = yaml_device_tree(devicegraph)
      if yaml_file.respond_to?(:write)
        # No timestamp if it's not a file
        yaml_file.write(device_tree.to_yaml)
      else
        File.open(yaml_file, "w") do |file|
          write_timestamp(file)
          file.write(device_tree.to_yaml)
        end
      end
    end

    # Convert all devices from the specified device graph to YAML data
    # structures, i.e. nested arrays and hashes. The toplevel item will
    # always be an array.
    #
    # @param devicegraph [Devicegraph]
    # @return [Array<Hash>]
    def yaml_device_tree(devicegraph)
      yaml = []
      top_level_devices(devicegraph).each { |device| yaml << yaml_disk_device(device) }
      devicegraph.software_raids.each { |s| yaml << yaml_software_raid(s) }
      devicegraph.lvm_vgs.each { |lvm_vg| yaml << yaml_lvm_vg(lvm_vg) }
      unsupported_devices(devicegraph).each { |device| yaml << yaml_unsupported_device(device) }
      yaml
    end

    private

    # Write a human-readable timestamp to a file.
    #
    # @param file [File]
    def write_timestamp(file)
      return unless file.respond_to?(:puts)

      file.puts("# #{Time.now}")
    end

    # Top level devices that will be converted to yaml format
    #
    # @return [Array<Y2Storage::Device>]
    def top_level_devices(devicegraph)
      devicegraph.disks + devicegraph.dasds
    end

    # Return the YAML counterpart of a disk device
    #
    # @param  device [Dasd, Disk]
    # @return [Hash]
    def yaml_disk_device(device)
      content = basic_disk_device_attributes(device)
      content.merge!(dasd_additional_attributes(device)) if device.is?(:dasd)
      content.merge!(yaml_blk_device_attributes(device))

      device = device.is?(:dasd) ? "dasd" : "disk"
      { device => content }
    end

    # Basic attributes of a block device
    #
    # @param device [Y2Storage::BlkDevice]
    # @return [Hash{String => Object}]
    def yaml_blk_device_attributes(device)
      if device.partition_table
        yaml_partition_table(device)
      else
        yaml_filesystem_and_encryption(device)
      end
    end

    # Basic attributes used to represent a disk device
    #
    # @param  device [Dasd, Disk]
    # @return [Hash{String => Object}]
    def basic_disk_device_attributes(device)
      {
        "name"       => device.name,
        "size"       => device.size.to_s,
        "block_size" => device.region.block_size.to_s,
        "io_size"    => DiskSize.B(device.topology.optimal_io_size).to_s,
        "min_grain"  => DiskSize.B(device.topology.minimal_grain).to_s,
        "align_ofs"  => DiskSize.B(device.topology.alignment_offset).to_s
      }
    end

    # Additional attributes for a DASD device
    #
    # @param  device [Dasd]
    # @return [Hash{String => Object}]
    def dasd_additional_attributes(device)
      content = {}
      content["type"] = device.type.to_s unless device.type.is?(:unknown)
      content["format"] = device.format.to_s unless device.format.is?(:none)
      content
    end

    # Returns the YAML counterpart of a Y2Storage::Md
    #
    # @note Md objects can represent BIOS RAIDs by using the subclass MdMember and
    #   MdContainer. This method is inteded to only export Md Software RAIDs.
    #
    # @param md [Y2Storage::Md]
    # @return [Hash]
    def yaml_software_raid(md)
      content = basic_md_attributes(md)
      content.merge!(yaml_blk_device_attributes(md))

      md_devices = yaml_md_devices(md)

      content["md_devices"] = md_devices unless md_devices.empty?

      { "md" => content }
    end

    # Basic attributes used to represent a Md
    #
    # @param md [Y2Storage::Md]
    # @return [Hash]
    def basic_md_attributes(md)
      {
        "name"         => md.name,
        "md_level"     => md.md_level.to_s,
        "md_parity"    => md.md_parity.to_s,
        "chunk_size"   => md.chunk_size.to_s,
        "md_uuid"      => md.uuid,
        "in_etc_mdadm" => md.in_etc_mdadm?,
        "metadata"     => md.metadata
      }
    end

    # Returns a YAML representation of the devices used by a Md
    #
    # @param md [Y2Storage::Md]
    # @return [Array<Hash>]
    def yaml_md_devices(md)
      devices = md.devices.sort_by(&:name)
      devices.map { |d| yaml_md_device(d) }
    end

    # Returns the YAML counterpart of a device used by a Md
    #
    # @param device [Y2Storage::BlkDevice]
    # @return [Hash]
    def yaml_md_device(device)
      content = {
        "blk_device" => device.name
      }

      { "md_device" => content }
    end

    # Returns the YAML counterpart of the partition table of a device
    # @param device [Y2Storage::BlkDevice]
    # @return [Hash]
    def yaml_partition_table(device)
      content = {}

      ptable = device.partition_table
      content["partition_table"] = ptable.type.to_s
      content["mbr_gap"] = ptable.minimal_mbr_gap.to_s if ptable.type.is?(:msdos)
      partitions = yaml_disk_device_partitions(device)
      content["partitions"] = partitions unless partitions.empty?

      content
    end

    # Returns a YAML representation of the partitions and free slots in a
    #   disk device
    #
    # Free slots are calculated as best as we can and not part of the
    #   partition table object.
    #
    # @param device [Dasd, Disk]
    # @return [Array<Hash>]
    #
    # FIXME: this method offends three different complexity cops!
    # rubocop:disable Metrics/AbcSize, Metrics/PerceivedComplexity, Metrics/CyclomaticComplexity
    def yaml_disk_device_partitions(device)
      partition_end = 0
      partition_end_max = 0
      partition_end_ext = 0
      partitions = []
      sorted_parts = sorted_partitions(device)
      sorted_parts.each do |partition|

        # if we are about to leave an extend partition, show what's left
        if partition_end_ext > 0 && !partition.type.is?(:logical)
          gap = partition_end_ext - partition_end
          partitions << yaml_free_slot(DiskSize.B(partition_end_ext - gap), DiskSize.B(gap)) if gap > 0
          partition_end = partition_end_ext
          partition_end_ext = 0
        end

        # is there a gap before the partition?
        # note: gap might actually be negative sometimes!
        gap = (partition.region.start * partition.region.block_size.to_i) - partition_end
        partitions << yaml_free_slot(DiskSize.B(partition_end), DiskSize.B(gap)) if gap > 0

        # show partition itself
        partitions << yaml_partition(partition)

        # adjust end pointers
        partition_end = next_start(partition.region) * partition.region.block_size.to_i
        partition_end_max = [partition_end_max, partition_end].max

        # if we're inside an extended partition, remember its end for later
        if partition.type.is?(:extended)
          partition_end_ext = partition_end
          partition_end = partition.region.start * partition.region.block_size.to_i
        end
      end

      # finally, show what's left

      # see if there's space left in an extended partition
      if partition_end_ext > 0
        gap = partition_end_ext - partition_end
        partitions << yaml_free_slot(DiskSize.B(partition_end_ext), DiskSize.B(gap)) if gap > 0
      end

      # see if there's space left at the end of the device
      # show also negative sizes so we know we've overstepped
      gap = (next_start(device.region) * device.region.block_size.to_i) - partition_end_max
      partitions << yaml_free_slot(DiskSize.B(partition_end_max), DiskSize.B(gap)) if gap != 0

      partitions
    end
    # rubocop:enable all

    # Start of the region or gap that comes right after the given region
    #
    # This method avoids the Storage exception raised when accessing Region#end
    # in case of zero sized regions.
    #
    # @param region [Region]
    # @return [Integer]
    def next_start(region)
      if region.length.zero?
        region.start
      else
        region.end + 1
      end
    end

    # Partitions sorted by position in the disk device and by type
    #
    # Start position is the primary criteria. In addition, extended partitions
    # are listed before any of its corresponding logical partitions
    #
    # @param device [Dasd, Disk]
    # @return [Array<Partition>]
    def sorted_partitions(device)
      device.partitions.sort do |a, b|
        by_start = a.region.start <=> b.region.start
        if by_start.zero?
          a.type.is?(:extended) ? -1 : 1
        else
          by_start
        end
      end
    end

    # Return the YAML counterpart of a Y2Storage::Partition.
    #
    # @param  partition [Partition]
    # @return [Hash]
    def yaml_partition(partition)
      content = {
        "size"  => partition.size.to_s,
        "start" => (partition.region.block_size * partition.region.start).to_s,
        "name"  => partition.name,
        "type"  => partition.type.to_s,
        "id"    => partition.id.to_s
      }

      content.merge!(yaml_filesystem_and_encryption(partition))

      { "partition" => content }
    end

    # Return the YAML counterpart of a free slot between partitions on a
    # disk.
    #
    # @param  size [DiskSize] size of the free slot
    # @return [Hash]
    #
    def yaml_free_slot(start, size)
      { "free" => { "size" => size.to_s, "start" => start.to_s } }
    end

    # Return the YAML counterpart of a Y2Storage::LvmVg.
    #
    # @param lvm_vg [LvmVg]
    # @return [Hash]
    #
    def yaml_lvm_vg(lvm_vg)
      content = basic_lvm_vg_attributes(lvm_vg)

      lvm_lvs = yaml_lvm_vg_lvm_lvs(lvm_vg)
      content["lvm_lvs"] = lvm_lvs unless lvm_lvs.empty?

      lvm_pvs = yaml_lvm_vg_lvm_pvs(lvm_vg)
      content["lvm_pvs"] = lvm_pvs

      { "lvm_vg" => content }
    end

    # Basic attributes used to represent a volume group
    #
    # @param lvm_vg [LvmVg]
    # @return [Hash{String => Object}]
    #
    def basic_lvm_vg_attributes(lvm_vg)
      {
        "vg_name"     => lvm_vg.vg_name,
        "extent_size" => lvm_vg.extent_size.to_s
      }
    end

    # Return a YAML representation of the logical volumes in a volume group
    #
    # @param lvm_vg [LvmVg]
    # @return [Array<Hash>]
    #
    def yaml_lvm_vg_lvm_lvs(lvm_vg)
      lvm_vg.lvm_lvs.sort_by(&:lv_name).map { |lvm_lv| yaml_lvm_lv(lvm_lv) }
    end

    # Return the YAML counterpart of a Y2Storage::LvmLv.
    #
    # @param lvm_lv [LvmLv]
    # @return [Hash]
    #
    def yaml_lvm_lv(lvm_lv)
      content = {
        "lv_name" => lvm_lv.lv_name,
        "size"    => lvm_lv.size.to_s
      }

      content["stripes"] = lvm_lv.stripes if lvm_lv.stripes != 0
      content["stripe_size"] = lvm_lv.stripe_size.to_s if lvm_lv.stripe_size != DiskSize.zero

      content.merge!(yaml_filesystem_and_encryption(lvm_lv))

      { "lvm_lv" => content }
    end

    # Return a YAML representation of the physical volumes in a volume group
    #
    # @param lvm_vg [LvmVg]
    # @return [Array<Hash>]
    #
    def yaml_lvm_vg_lvm_pvs(lvm_vg)
      pvs = lvm_vg.lvm_pvs.sort_by { |pv| pv.blk_device.name }
      pvs.map { |lvm_pv| yaml_lvm_pv(lvm_pv) }
    end

    # Return the YAML counterpart of a Y2Storage::LvmPv.
    #
    # @param lvm_pv [LvmPv]
    # @return [Hash]
    #
    def yaml_lvm_pv(lvm_pv)
      content = {
        "blk_device" => lvm_pv.blk_device.name
      }

      { "lvm_pv" => content }
    end

    # Return the YAML counterpart of a filesystem and encryption.
    #
    # @param parent [Dasd, Disk, Partition, LvmLv]
    # @return [Hash]
    #
    def yaml_filesystem_and_encryption(parent)
      content = {}
      if parent.filesystem
        content.merge!(yaml_filesystem(parent.filesystem))
        content.merge!(yaml_btrfs_subvolumes(parent.filesystem))
      end
      if parent.encryption
        encryption = parent.encryption
        content.merge!(yaml_encryption(encryption))
        if encryption.filesystem
          filesystem = encryption.filesystem
          content.merge!(yaml_filesystem(filesystem))
          content.merge!(yaml_btrfs_subvolumes(filesystem))
        end
      end
      content
    end

    # Return the YAML counterpart of a Y2Storage::BlkFilesystem.
    #
    # @param file_system [BlkFilesystem]
    # @return [Hash{String => Object}]
    #
    def yaml_filesystem(file_system)
      content = {
        "file_system" => file_system.type.to_s
      }

      content["label"] = file_system.label unless file_system.label.empty?

      if file_system.mount_point
        content["mount_point"] = file_system.mount_point.path
        mount_options = file_system.mount_point.mount_options
        content["fstab_options"] = mount_options unless mount_options.empty?
      end

      content
    end

    # Return the YAML counterpart of a Y2Storage::Encryption.
    #
    # @param encryption [BlkFilesystem]
    # @return [Hash{String => Object}]
    #
    def yaml_encryption(encryption)
      content = {
        "type" => encryption.type.to_human_string,
        "name" => encryption.name
      }

      content["pbkdf"] = encryption.pbkdf_value unless encryption.pbkdf_value.empty?
      content["authentication"] = encryption.authentication.value if encryption.authentication

      if !encryption.password.empty?
        content["password"] = @record_passwords ? encryption.password : "***"
      end

      { "encryption" => content }
    end

    # Return the YAML counterpart of a Btrfs's subvolumes or an empty hash if
    # the filesystem is not Btrfs.
    #
    # @param filesystem [Filesystems::BlkFilesystem]
    # @return [Hash{String => Object}]
    #
    def yaml_btrfs_subvolumes(filesystem)
      return {} unless filesystem.type.is?(:btrfs)

      subvolumes = filesystem.btrfs_subvolumes
      return {} if subvolumes.empty? # the toplevel subvol doesn't have a path

      default_subvolume = subvolumes.find { |s| s.default_btrfs_subvolume? && !s.path.empty? }
      content = {}
      content["default_subvolume"] = default_subvolume.path if default_subvolume
      content["subvolumes"] = subvolumes.map do |subvol|
        yaml_btrfs_subvolume(subvol)
      end.compact

      { "btrfs" => content }
    end

    # Return the YAML counterpart of one Btrfs subvolume or nil if it has an
    # empty path.
    #
    # @param subvol [BtrfsSubvolume]
    # @return [Hash{String=>Object}] YAML
    #
    def yaml_btrfs_subvolume(subvol)
      return nil if subvol.path.empty?

      content = { "path" => subvol.path }
      content["nocow"] = true if subvol.nocow?
      { "subvolume" => content }
    end

    # Return YAML for one unsupported device.
    #
    # @param device [Device]
    # @return [Hash]
    def yaml_unsupported_device(device)
      content = {}
      content["type"] = device.class.to_s
      content["name"] = device.name if device.respond_to?(:name)
      content["support"] = "unsupported in YAML - check XML"

      { "unsupported_device" => content }
    end

    # Return all unsupported devices in a devicegraph. Right now this is
    # limited to block devices and non-block-filesystem filesystems like NFS.
    #
    # @param devicegraph [Devicegraph]
    # @return [Array<Device>]
    def unsupported_devices(devicegraph)
      unsupported_blk_devices(devicegraph) + non_blk_filesystem_filesystems(devicegraph)
    end

    # Return all unsupported block devices in a devicegraph.
    #
    # @param devicegraph [Devicegraph]
    # @return [Array<Device>]
    def unsupported_blk_devices(devicegraph)
      BlkDevice.all(devicegraph).reject { |d| supported_blk_device?(d) }
    end

    # Return all unsupported filesystems in a devicegraph.
    #
    # @param devicegraph [Devicegraph]
    # @return [Array<Device>]
    def non_blk_filesystem_filesystems(devicegraph)
      devicegraph.filesystems.reject { |fs| fs.is?(:blk_filesystem) }
    end

    # Check if a block device is supported by the YAML writer.
    #
    # @param blk_device [BlkDevice]
    # @return [Boolean]
    def supported_blk_device?(blk_device)
      # See class hierarchy in libstorage-ng BlkDevice autodocs
      #
      # NOTICE: We can't simply only handle devicegraph toplevel objects since
      # some of the unsupported ones (e.g. RAIDs) don't have a bracketing
      # toplevel object, unlike LVM with VGs.
      blk_device.is?(:disk, :dasd, :software_raid, :encryption, :lvm_lv, :partition)
    end
  end
end
