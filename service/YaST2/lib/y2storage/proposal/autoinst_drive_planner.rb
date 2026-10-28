# Copyright (c) [2018-2019] SUSE LLC
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

require "yast"
require "y2storage/proposal_settings"
require "y2storage/proposal/autoinst_size_parser"
require "y2storage/volume_specification"

module Y2Storage
  module Proposal
    # This module offers a set of common methods that are used by AutoYaST planners.
    class AutoinstDrivePlanner # rubocop:disable Metrics/ClassLength
      include Yast::Logger
      # @!attribute [r] devicegraph
      #   @return [Devicegraph]
      # @!attribute [r] issues_list
      #
      attr_reader :devicegraph, :issues_list

      # Constructor
      #
      # @param devicegraph [Devicegraph] Devicegraph to be used as starting point
      # @param issues_list [AutoinstIssues::List] List of AutoYaST issues to register them
      def initialize(devicegraph, issues_list)
        @devicegraph = devicegraph
        @issues_list = issues_list
      end

      # Returns a planned volume group according to an AutoYaST specification
      #
      # @param _drive [AutoinstProfile::DriveSection] drive section
      # @return [Array] Array of planned devices
      def planned_devices(_drive)
        raise NotImplementedError
      end

      private

      # Set all the common attributes that are shared by any device defined by
      # a <partition> section of AutoYaST (i.e. a LV, MD or partition).
      #
      # @param device  [Planned::Device] Planned device
      # @param partition_section [AutoinstProfile::PartitionSection] AutoYaST
      #   specification of the concrete device
      # @param drive_section [AutoinstProfile::DriveSection] AutoYaST drive
      #   section containing the partition one
      def configure_device(device, partition_section, drive_section)
        configure_filesystem(device, partition_section, drive_section)
        configure_usage(device, partition_section)
        add_encryption_attrs(device, partition_section)
      end

      alias_method :device_config, :configure_device

      # Sets those attributes that determine how the device will be used (file system, RAID member, etc.)
      #
      # A device can be used as file system, a RAID member, an LVM PV, a Bcache backing/caching device
      # or as part of a Btrfs multi-device. And in the future, the list might grow.
      #
      # The logic to determine which device to honor is quite simple and it could be improved
      # in the future if needed.
      #
      # @param device  [Planned::Device] Planned device
      # @param partition_section [AutoinstProfile::PartitionSection] AutoYaST
      #   specification of the concrete device
      def configure_usage(device, partition_section)
        usage_attr, *ignored_attrs = usage_attrs_in(partition_section)
        return if usage_attr.nil?

        meth = USAGE_ATTRS_MAP[usage_attr] || usage_attr
        meth = "#{meth}="
        device.public_send(meth, partition_section.public_send(usage_attr)) if device.respond_to?(meth)
        return if ignored_attrs.empty?

        issues_list.add(Y2Storage::AutoinstIssues::ConflictingAttrs,
          partition_section, usage_attr, ignored_attrs)
      end

      # @return [Array<Symbol>] List of 'usage' attributes. The list is ordered by precedence.
      USAGE_ATTRS = [
        :mount, :raid_name, :lvm_group, :btrfs_name, :bcache_backing_for, :bcache_caching_for
      ]
      private_constant :USAGE_ATTRS

      # @return [Array<Symbol>] Map of 'usage' attributes to planned device methods. The map
      #   only contains those attributes which names does not match.
      USAGE_ATTRS_MAP = {
        lvm_group: :lvm_volume_group_name,
        mount:     :mount_point
      }
      private_constant :USAGE_ATTRS_MAP

      # Returns the attributes which determines how the device will be used
      #
      # @param partition_section [AutoinstProfile::PartitionSection] Partition specification
      # @return [Array<Symbol>] List of usage related attributes which are defined
      def usage_attrs_in(partition_section)
        USAGE_ATTRS.reject do |e|
          value = partition_section.public_send(e)
          value.nil? || (value.is_a?(Array) && value.empty?)
        end
      end

      # Sets all common filesystem attributes (e.g., label, uuid, mount point, etc)
      #
      # @param device  [Planned::Device]
      # @param partition_section [AutoinstProfile::PartitionSection]
      # @param drive_section [AutoinstProfile::DriveSection]
      def configure_filesystem(device, partition_section, drive_section)
        add_filesystem_attrs(device, partition_section)

        configure_snapshots(device, drive_section)
        configure_subvolumes(device, partition_section)
      end

      DEFAULT_ENCRYPTION_METHOD = EncryptionMethod.find(:luks1)
      private_constant :DEFAULT_ENCRYPTION_METHOD

      # Sets encryption attributes
      #
      # @param device [Planned::Device] Planned device
      # @param partition_section [AutoinstProfile::PartitionSection] AutoYaST specification
      def add_encryption_attrs(device, partition_section)
        return unless partition_section.crypt_fs || partition_section.crypt_method

        device.encryption_method =
          if partition_section.crypt_method
            find_encryption_method(device, partition_section)
          else
            DEFAULT_ENCRYPTION_METHOD
          end
        device.encryption_pbkdf = find_encryption_pbkdf(partition_section)
        device.encryption_label = partition_section.crypt_label
        device.encryption_cipher = partition_section.crypt_cipher
        device.encryption_key_size = encryption_key_size_for(partition_section)
        if device.encryption_method&.is?(:pervasive_luks2)
          device.encryption_pervasive_apqns = apqns_for(partition_section)
          device.encryption_pervasive_key_type = partition_section.crypt_pervasive_key_type
        end
        return unless device.encryption_method&.password_required?

        device.encryption_password = find_encryption_password(partition_section)
      end

      # Determines if the given apqn is valid for being used for pervasive_luks2 encryption
      #
      # @param apqn [EncryptionProcesses::Apqn]
      # @return [Boolean] whether the given apqn can be used for pervasive_luks2 encryption
      def valid_apqn_candidate?(apqn)
        if apqn.online?
          return true if apqn.master_key_pattern

          log.error "The APQN #{apqn.name} does not have a configured master key pattern"
        else
          log.error "The APQN #{apqn.name} is not online"
        end
        false
      end

      # Obtains the online APQNs for a partition section
      #
      # @param partition_section [AutoinstProfile::PartitionSection] AutoYaST specification
      # @return [Array<EncryptionProcesses::Apqn>]
      def apqns_for(partition_section)
        result = []
        apqns = partition_section.crypt_pervasive_apqns || []
        all_apqns = Y2Storage::EncryptionProcesses::Apqn.all
        apqns.each do |name|
          apqn = all_apqns.find { |a| a.name == name }
          if apqn
            result << apqn if valid_apqn_candidate?(apqn)
          else
            log.error "The APQN #{name} was not found"
          end
        end
        result
      end

      # Determines the encryption method for a partition section
      #
      # @param device [Planned::Device] Planned device
      # @param partition_section [AutoinstProfile::PartitionSection] AutoYaST specification
      # @return [EncryptionMethod,nil] Encryption method ID or nil if it could not be determined
      def find_encryption_method(device, partition_section)
        encryption_method = EncryptionMethod.find(partition_section.crypt_method)
        error =
          if encryption_method.nil?
            :unknown
          elsif !encryption_method.available?
            :unavailable
          elsif !device.supported_encryption_method?(encryption_method)
            :unsuitable
          end

        if error
          issues_list.add(Y2Storage::AutoinstIssues::InvalidEncryption, partition_section, error)
          return
        end

        encryption_method
      end

      # Extracts the encryption password for a partition section
      #
      # Additionally it registers an issue if it is not found.
      #
      # @return [String,nil]
      def find_encryption_password(partition_section)
        if partition_section.crypt_key.nil? || partition_section.crypt_key.empty?
          issues_list.add(Y2Storage::AutoinstIssues::MissingValue, partition_section, :crypt_key)
          return
        end
        partition_section.crypt_key
      end

      # Determines the encryption password-based key derivation function for a partition section
      #
      # Additionally it registers an issue if a value is specified but it does not correspond to
      # any function recognized by YaST.
      #
      # @param part_section [AutoinstProfile::PartitionSection] AutoYaST specification
      # @return [PbkdFunction,nil] nil if the field is omitted or the value is invalid
      def find_encryption_pbkdf(part_section)
        return unless part_section.crypt_pbkdf

        result = Y2Storage::PbkdFunction.find(part_section.crypt_pbkdf)
        if result.nil?
          # There is an InvalidEncryption kind of issue, but it looks oriented to report a wrong
          # encryption_method, which is a more critical error than this
          issues_list.add(Y2Storage::AutoinstIssues::InvalidValue, part_section, :crypt_pbkdf)
        end
        result
      end

      # Encryption key size in the given partition section
      #
      # Additionally it registers an issue if a value is specified but is not valid (is not
      # a multiple of 8).
      #
      # @param part_section [AutoinstProfile::PartitionSection] AutoYaST specification
      # @return [Integer,nil] nil if the field is omitted or the value is invalid
      def encryption_key_size_for(part_section)
        return unless part_section.crypt_key_size

        value = part_section.crypt_key_size.to_i
        if value % 8 != 0
          issues_list.add(Y2Storage::AutoinstIssues::InvalidValue, part_section, :crypt_key_size)
          return
        end

        value
      end

      # Sets common filesystem attributes
      #
      # @param device  [Planned::Device]
      # @param partition_section [AutoinstProfile::PartitionSection]
      def add_filesystem_attrs(device, partition_section)
        device.mount_point = partition_section.mount
        device.label = partition_section.label
        device.filesystem_type = filesystem_for(partition_section)
        device.mount_by = partition_section.type_for_mountby
        device.mkfs_options = partition_section.mkfs_options
        device.fstab_options = partition_section.fstab_options
        device.read_only = read_only?(partition_section.mount)
      end

      # Sets device attributes related to snapshots
      #
      # This method modifies the first argument
      #
      # @param device  [Planned::Device] Planned device
      # @param drive_section [AutoinstProfile::DriveSection] AutoYaST specification
      def configure_snapshots(device, drive_section)
        return unless device.respond_to?(:root?) && device.root?

        # Always try to enable snapshots if possible
        snapshots = true
        snapshots = false if drive_section.enable_snapshots == false

        device.snapshots = snapshots
      end

      # Sets devices attributes related to Btrfs subvolumes
      #
      # This method modifies the first argument setting default_subvolume and
      # subvolumes.
      #
      # @param device  [Planned::Device] Planned device
      # @param section [AutoinstProfile::PartitionSection] AutoYaST specification
      def configure_subvolumes(device, section)
        return unless device.btrfs?

        defaults = subvolume_attrs_for(device.mount_point)

        device.default_subvolume = section.subvolumes_prefix || defaults[:subvolumes_prefix]

        device.subvolumes =
          if section.create_subvolumes
            section.subvolumes || defaults[:subvolumes] || []
          else
            []
          end

        configure_btrfs_quotas(device, section)
      end

      # Sets the Btrfs quotas according to the section and the subvolumes
      #
      # If `section.quotas` is nil, it inspect whether quotas are needed for any
      # of the subvolumes. In that case, it sets `device.quota` to true.
      #
      # @param device  [Planned::Device] Planned device
      # @param section [AutoinstProfile::PartitionSection] AutoYaST specification
      def configure_btrfs_quotas(device, section)
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

      # @param planned_device [Planned::Device] Planned device
      # @param device         [Y2Storage::Device] Device to reuse
      # @param section        [AutoinstProfile::PartitionSection] AutoYaST specification
      def add_device_reuse(planned_device, device, section)
        planned_device.reuse_name = device.is_a?(LvmVg) ? device.volume_group_name : device.name
        planned_device.uuid = section.uuid
        planned_device.resize = !!section.resize if planned_device.respond_to?(:resize=)
        config_filesystem_reuse(planned_device, device, section)
      end

      # @param planned_device [Planned::Device] Planned device
      # @param device         [Y2Storage::Device] Device to reuse
      # @param section        [AutoinstProfile::PartitionSection,AutoinstProfile::Drive] relevant section
      #   of the AutoYaST specification
      def config_filesystem_reuse(planned_device, device, section)
        return unless section.is_a?(AutoinstProfile::PartitionSection)

        planned_device.reformat = !!section.format
        check_reusable_filesystem(planned_device, device, section) if device.respond_to?(:filesystem)
      end

      # @param planned_device [Planned::Partition,Planned::LvmLV,Planned::Md] Planned device
      # @param device         [Y2Storage::Device] Device to reuse
      # @param section        [AutoinstProfile::PartitionSection] AutoYaST specification
      def check_reusable_filesystem(planned_device, device, section)
        return if planned_device.reformat || device.filesystem || planned_device.component?
        # The device to be reused doesn't have filesystem... but maybe it's not
        # really needed, e.g. reusing a bios_boot partition (bsc#1134330)
        return if planned_device.mount_point.nil? && planned_device.filesystem_type.nil?

        issues_list.add(Y2Storage::AutoinstIssues::MissingReusableFilesystem, section)
      end

      # Parse the 'size' element
      #
      # @param section [AutoinstProfile::PartitionSection]
      # @param min     [DiskSize] Minimal size
      # @param max     [DiskSize] Maximal size
      # @see AutoinstSizeParser
      def parse_size(section, min, max)
        AutoinstSizeParser.new(proposal_settings).parse(section.size, section.mount, min, max)
      end

      # Instance of {ProposalSettings} based on the current product.
      #
      # Used to ensure consistency between the guided proposal and the AutoYaST
      # one when default values are used.
      #
      # @return [ProposalSettings]
      def proposal_settings
        @proposal_settings ||= ProposalSettings.new_for_current_product
      end

      # Set 'reusing' attributes for a partition
      #
      # This method modifies the first argument setting the values related to
      # reusing a partition (reuse and format).
      #
      # @param partition [Planned::Partition] Planned partition
      # @param section   [AutoinstProfile::PartitionSection] AutoYaST specification
      def add_partition_reuse(partition, section)
        partition_to_reuse = find_partition_to_reuse(partition, section)
        return unless partition_to_reuse

        partition.filesystem_type ||= partition_to_reuse.filesystem_type
        add_device_reuse(partition, partition_to_reuse, section)
      end

      # @param partition    [Planned::Partition] Planned partition
      # @param part_section [AutoinstProfile::PartitionSection] Partition specification
      #   from AutoYaST
      def find_partition_to_reuse(partition, part_section)
        disk = devicegraph.find_by_name(partition.disk)
        device =
          if part_section.partition_nr
            disk.partitions.find { |i| i.number == part_section.partition_nr }
          elsif part_section.uuid
            disk.partitions.find { |i| i.filesystem_uuid == part_section.uuid }
          elsif part_section.label
            disk.partitions.find { |i| i.filesystem_label == part_section.label }
          else
            issues_list.add(Y2Storage::AutoinstIssues::MissingReuseInfo, part_section)
            nil
          end

        issues_list.add(Y2Storage::AutoinstIssues::MissingReusableDevice, part_section) unless device
        device
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
