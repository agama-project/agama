# Copyright (c) [2015] SUSE LLC
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
require "yast/i18n"
require "y2storage/disk_size"
require "y2storage/filesystems/type"
require "y2storage/planned"
require "y2storage/boot_requirements_strategies/analyzer"
require "y2storage/exceptions"
require "y2storage/volume_specification"
require "y2storage/setup_error"
require "y2storage/volume_specification_builder"
require "y2storage/pbkd_function"

module Y2Storage
  module BootRequirementsStrategies
    class Error < Y2Storage::Error
    end

    # Base class for the strategies used to calculate the boot partitioning
    # requirements
    class Base
      include Yast::Logger
      include Yast::I18n
      extend Forwardable

      def_delegators :@analyzer,
        :root_filesystem, :boot_disk, :boot_ptable_type?, :free_mountpoint?,
        :root_in_lvm?, :root_in_software_raid?, :encrypted_root?, :btrfs_root?,
        :root_fs_can_embed_grub?, :boot_in_lvm?,
        :boot_in_thin_lvm?, :boot_in_bcache?, :boot_in_software_raid?, :encrypted_boot?,
        :boot_fs_can_embed_grub?, :boot_filesystem_type, :boot_encryption_type, :boot_luks2_pbkdf,
        :esp_in_lvm?, :esp_in_software_raid?, :esp_in_software_raid1?, :encrypted_esp?

      # Constructor
      #
      # @see [BootRequirementsChecker#devicegraph]
      # @see [BootRequirementsChecker#planned_devices]
      # @see [BootRequirementsChecker#boot_disk_name]
      def initialize(devicegraph, planned_devices, boot_disk_name)
        textdomain "storage"

        @devicegraph = devicegraph
        @analyzer = Analyzer.new(devicegraph, planned_devices, boot_disk_name)

        log.info "boot disk: #{boot_disk.inspect}"
      end

      # Partitions that should be created to boot the system
      #
      # @param target [Symbol] :desired, :min
      #
      # @return [Array<Planned::Partition>]
      def needed_partitions(target)
        planned_partitions = []
        planned_partitions << boot_partition(target) if boot_partition_needed? && boot_partition_missing?
        planned_partitions
      end

      # All boot warnings detected in the setup, for example, when required partition is too small
      #
      # @note This method should be overloaded for derived classes.
      #
      # @see SetupError
      #
      # @return [Array<SetupError>]
      def warnings
        res = []

        if grub_warning? && !boot_readable_by_grub?
          error_message =
            _(
              "The grub boot loader cannot access the file system mounted at /boot. " \
              "Only LUKS1 and LUKS2 with PBKDF2 encryption is supported. Another boot loader can be "\
              "selected in the boot loader section, for example systemd_boot or grub2_bls."
            )
          res << SetupError.new(message: error_message)
        end

        if boot_in_thin_lvm?
          error_message =
            _("The device mounted at '/boot' should not be in a thinly provisioned LVM VG.")
          res << SetupError.new(message: error_message)
        end

        if boot_in_bcache?
          error_message =
            _("The device mounted at '/boot' should not be in a BCache.")
          res << SetupError.new(message: error_message)
        end

        res
      end

      # Checks if it makes sense to show grub warnings
      #
      # @return [Boolean]
      def grub_warning?
        true
      end

      # All fatal boot errors detected in the setup, for example, when a / partition
      # is missing
      #
      # @note errors must be raised only in those scenarios making the installation impossible.
      #   For any other circumstance please use {#warnings} instead.
      #
      # @note This method can be overloaded for derived classes.
      #
      # @see SetupError
      #
      # @return [Array<SetupError>]
      def errors
        res = []

        res << no_root_error if root_filesystem_missing?

        if too_small_boot?
          error_message =
            _("The device mounted at '/boot' does not have enough space to contain a kernel.")
          res << SetupError.new(message: error_message)
        end

        res
      end

      protected

      # @return [Devicegraph]
      attr_reader :devicegraph

      # @return [BootRequirementsStrategies::Analyzer]
      attr_reader :analyzer

      # Whether there is not root
      #
      # @return [Boolean] true if there is no root; false otherwise.
      def root_filesystem_missing?
        root_filesystem.nil?
      end

      def boot_partition_needed?
        !boot_readable_by_grub?
      end

      def too_small_boot?
        # for other partitions it is not needed as packager check disk usage, but /boot is special
        # as it contain initrd that is generated and also bootloader code.
        filesystem = devicegraph.filesystems.find { |f| f.mount_path == "/boot" }
        return false unless filesystem

        # it is not 100% exact for new fs, but good estimation
        filesystem.free_space < boot_volume.min_size
      end

      def boot_partition_missing?
        free_mountpoint?("/boot")
      end

      # @return [VolumeSpecification]
      def boot_volume
        @boot_volume ||= volume_specification_for("/boot")
      end

      # @return [VolumeSpecification,nil]
      def volume_specification_for(mount_point)
        VolumeSpecificationBuilder.new.for(mount_point)
      end

      # @return [Planned::Partition]
      def boot_partition(target)
        planned_partition = create_planned_partition(boot_volume, target)
        planned_partition.disk = boot_disk.name
        planned_partition
      end

      # Create a planned partition from a volume specification
      #
      # @param volume [VolumeSpecification]
      # @param target [Symbol] :desired, :min
      #
      # @return [VolumeSpecification]
      def create_planned_partition(volume, target)
        planned_partition = Planned::Partition.new(volume.mount_point, volume.fs_type)
        planned_partition.min_size = (target == :min) ? volume.min_size : volume.desired_size
        planned_partition.max_size = volume.max_size
        planned_partition.partition_id = volume.partition_id
        planned_partition.weight = analyzer.max_planned_weight || 0.0
        planned_partition
      end

      # Whether there is no partition that matches the volume
      #
      # @param volume [VolumeSpecification]
      # @param exclude [Array<Symbol>, Symbol] see {MatchVolumeSpec#match_volume?}
      # @return [Boolean] true if there is no partition; false otherwise.
      def missing_partition_for?(volume, exclude: [])
        Partition.all(devicegraph).none? { |p| p.match_volume?(volume, exclude: exclude) }
      end

      # Specific error when the boot disk cannot be detected
      #
      # @return [SetupError]
      def unknown_boot_disk_error
        # TRANSLATORS: error message
        error_message = _("Boot requirements cannot be determined because there is no '/' mount point")
        SetupError.new(message: error_message)
      end

      # Whether the boot device can be read by grub
      #
      # The boot device can be read by grub when:
      #
      # * it is not encrypted (obviously),
      # * or it is encrypted using LUKS1.
      # * or it is encrypted using LUKS2 with PBKDF2 as key derivation function
      #
      # @return [Boolean] true if grub can read the boot device
      def boot_readable_by_grub?
        t = boot_encryption_type
        # FIXME: In fact, this is true only in TW and ALP. The Grub2 package at SLE-15-SP5 is not able
        # to perform the autoconfiguration for LUKS2 devices, no matter what PBKDF is used.
        return boot_luks2_pbkdf == PbkdFunction::PBKDF2 if t.is?(:luks2)

        t.is?(:none) || t.is?(:luks1)
      end

      # Error describing a setup with no root filesystem
      #
      # @see #errors
      #
      # @return SetupError
      def no_root_error
        error_message = _("There is no device mounted at '/'")
        SetupError.new(message: error_message)
      end
    end
  end
end
