# Copyright (c) [2024] SUSE LLC
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

require "y2storage/proposal_settings"
require "y2storage/proposal/autoinst_size_parser"
require "y2storage/volume_specification"

module Y2Storage
  module Proposal
    # This module offers a set of common methods that are used by Agama planners.
    class AgamaDevicePlanner
      # @!attribute [r] devicegraph
      #   @return [Devicegraph]
      # @!attribute [r] issues_list
      #
      attr_reader :devicegraph, :config, :issues_list

      # Constructor
      #
      # @param devicegraph [Devicegraph] Devicegraph to be used as starting point
      # @param issues_list [AutoinstIssues::List] List of AutoYaST issues to register them
      def initialize(devicegraph, config, issues_list)
        @devicegraph = devicegraph
        @config = config
        @issues_list = issues_list
      end

      # Returns a planned volume group according to an AutoYaST specification
      #
      # @param _drive [AutoinstProfile::DriveSection] drive section
      # @return [Array] Array of planned devices
      def planned_devices(_setting)
        raise NotImplementedError
      end

      private

      # @param device  [Planned::Device] Planned device
      def configure_device(device, specification)
        configure_mount(device, specification)
        configure_format(device, specification)
      end

      # @param device  [Planned::Device]
      def configure_format(device, spec)
        format = spec.format
        return unless format

        device.label = format.label
        device.mkfs_options = format.mkfs_options
        device.filesystem_type = filesystem_for(spec)

        btrfs = format.btrfs_info? ? format.filesystem : nil
        configure_btrfs(device, btrfs)
      end

      # @param device  [Planned::Device]
      def configure_mount(device, spec)
        mount = spec.mount
        return unless mount

        device.mount_point = mount.path
        device.fstab_options = mount.mount_options
        device.mount_by = mount.type_for_mount_by
      end

      # TODO: support the case in which btrfs is nil
      def configure_btrfs(device, btrfs)
        configure_snapshots(device, btrfs)
        configure_subvolumes(device, btrfs)
      end

      # Sets device attributes related to snapshots
      #
      # This method modifies the first argument
      #
      # @param device  [Planned::Device] Planned device
      def configure_snapshots(device, btrfs)
        return unless device.respond_to?(:root?) && device.root?
        device.snapshots = btrfs.snapshots?
      end

      # Sets devices attributes related to Btrfs subvolumes
      #
      # This method modifies the first argument setting default_subvolume and
      # subvolumes.
      #
      # @param device  [Planned::Device] Planned device
      def configure_subvolumes(device, btrfs)
        defaults = subvolume_attrs_for(device.mount_point)

        device.default_subvolume = btrfs.subvolumes_prefix || defaults[:subvolumes_prefix]

        device.subvolumes = section.subvolumes || defaults[:subvolumes] || []
        configure_btrfs_quotas(device, btrfs)
      end

      # Sets the Btrfs quotas according to the section and the subvolumes
      #
      # If `section.quotas` is nil, it inspect whether quotas are needed for any
      # of the subvolumes. In that case, it sets `device.quota` to true.
      #
      # @param device  [Planned::Device] Planned device
      def configure_btrfs_quotas(device, btrfs)
        if !section.quotas.nil?
          device.quota = section.quotas
          return
        end

        subvols_with_quotas = device.subvolumes.select do |subvol|
          subvol.referenced_limit && !subvol.referenced_limit.unlimited?
        end
        return if subvols_with_quotas.empty?

        device.quota = true
        issues_list.add(
          Y2Storage::AutoinstIssues::MissingBtrfsQuotas, section, subvols_with_quotas
        )
      end

      # Return the default subvolume attributes for a given mount point
      #
      # @param mount [String] Mount point
      # @return [Hash]
      def subvolume_attrs_for(mount)
        return {} if mount.nil?

        spec = VolumeSpecification.for(mount)
        return {} if spec.nil?

        { subvolumes_prefix: spec.btrfs_default_subvolume, subvolumes: spec.subvolumes }
      end

      # Return the filesystem type for a given section
      #
      # @param partition_section [AutoinstProfile::PartitionSection] AutoYaST specification
      # @return [Filesystems::Type] Filesystem type
      def filesystem_for(partition_section)
        return partition_section.type_for_filesystem if partition_section.type_for_filesystem
        return nil unless partition_section.mount

        default_filesystem_for(partition_section)
      end

      # Return the default filesystem type for a given section
      #
      # @param section [AutoinstProfile::PartitionSection]
      # @return [Filesystems::Type] Filesystem type
      def default_filesystem_for(section)
        spec = VolumeSpecification.for(section.mount)
        return spec.fs_type if spec&.fs_type

        (section.mount == "swap") ? Filesystems::Type::SWAP : Filesystems::Type::BTRFS
      end

      # Determine whether the filesystem for the given mount point should be read-only
      #
      # @param mount_point [String] Filesystem mount point
      # @return [Boolean] true if it should be read-only; false otherwise.
      def read_only?(mount_point)
        return false unless mount_point

        spec = VolumeSpecification.for(mount_point)
        !!spec && spec.btrfs_read_only?
      end

      # @return [DiskSize] Minimal partition size
      PARTITION_MIN_SIZE = DiskSize.B(1).freeze

      # @param container [Planned::Disk,Planned::Dasd,Planned::Md] Device to place the partitions on
      # @param drive [AutoinstProfile::DriveSection]
      # @param section [AutoinstProfile::PartitionSection]
      # @return [Planned::Partition,nil]
      def plan_partition(container, drive, section)
        partition = Y2Storage::Planned::Partition.new(nil, nil)

        return unless assign_size_to_partition(partition, section)

        partition.disk = container.name
        partition.partition_id = section.id_for_partition
        partition.primary = section.partition_type == "primary" if section.partition_type
        device_config(partition, section, drive)
        add_partition_reuse(partition, section) if section.create == false
        partition
      end

      # Assign disk size according to AutoYaSt section
      #
      # @param partition   [Planned::Partition] Partition to assign the size to
      # @param part_section   [AutoinstProfile::PartitionSection] Partition specification from AutoYaST
      def assign_size_to_partition(partition, part_section)
        size_info = parse_size(part_section, PARTITION_MIN_SIZE, DiskSize.unlimited)

        if size_info.nil?
          issues_list.add(Y2Storage::AutoinstIssues::InvalidValue, part_section, :size)
          return false
        end

        partition.percent_size = size_info.percentage
        partition.min_size = size_info.min
        partition.max_size = size_info.max
        partition.weight = 1 if size_info.unlimited?
        true
      end
    end
  end
end
