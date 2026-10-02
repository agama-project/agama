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
require "y2storage/boot_requirements_strategies"
require "y2storage/storage_manager"
require "y2storage/storage_env"
require "y2storage/bootloader_type"

Yast.import "Arch"

module Y2Storage
  #
  # Class that can check requirements for the different kinds of boot
  # partition: /boot, EFI-boot, PReP.
  #
  # See also
  # https://github.com/yast/yast-bootloader/blob/master/SUPPORTED_SCENARIOS.md
  #
  class BootRequirementsChecker
    include Yast::Logger

    class Error < RuntimeError
    end

    # Constructor
    #
    # @see #devicegraph
    # @see #planned_devices
    # @see #boot_disk_name
    # @see #bootloader
    def initialize(
      devicegraph, planned_devices: [], boot_disk_name: nil, bootloader: BootloaderType::GRUB2
    )
      @devicegraph = devicegraph
      @planned_devices = planned_devices
      @boot_disk_name = boot_disk_name
      @bootloader = bootloader
    end

    # Partitions needed in order to be able to boot the system
    #
    # So far, this method is used by {GuidedProposal} and by {AutoinstProposal},
    # since both need to know which partitions they should create.
    #
    # At the moment of writing, this is not used directly by {SetupChecker}
    # (the mechanism used by the Partitioner to find and report wrong setups).
    # See {#errors} and {#warnings} for that.
    #
    # @raise [BootRequirementsChecker::Error] if adding partitions is not
    #     enough to make the system bootable
    #
    # @param target [Symbol] :desired means the sizes of the partitions should
    #   be the ideal ones, :min for generating the smallest functional partitions
    #
    # @return [Array<Planned::Partition>]
    def needed_partitions(target = :desired)
      strategy.needed_partitions(target)
    rescue BootRequirementsStrategies::Error => e
      raise Error, e.message
    end

    # Whether the current setup contains all necessary devices for booting
    #
    # @return [Boolean]
    def valid?
      errors.empty? && warnings.empty?
    end

    # All boot warnings detected in the setup, for example, when size of a /boot/efi partition
    # is out of borders.
    #
    # So far, this is mainly used by {SetupError} (which is the mechanism used
    # by the partitioner). The proposals rely on {#needed_partitions} instead.
    #
    # @return [Array<SetupError>]
    def warnings
      strategy.warnings
    end

    # All fatal boot errors detected in the setup, for example, when a /boot/efi partition
    # is missing in a UEFI system
    #
    # So far, this is mainly used by {SetupError} (which is the mechanism used
    # by the partitioner). The proposals rely on {#needed_partitions} instead.
    #
    # @return [Array<SetupError>]
    def errors
      strategy.errors
    end

    protected

    # @return [Devicegraph] starting situation.
    attr_reader :devicegraph

    # @return [Array<Planned::Device>] devices that are already planned to be
    #   added to the starting devicegraph.
    attr_reader :planned_devices

    # @return [String, nil] device name of the disk that the system will try to
    #   boot first. Only useful in some scenarios like legacy boot.
    #   See {BootRequirementsStrategies::Analyzer#boot_disk}.
    attr_reader :boot_disk_name

    # @return [BootloaderType] type of bootloader that will be installed
    attr_reader :bootloader

    def arch
      @arch ||= StorageManager.instance.arch
    end

    def strategy
      @strategy ||= strategy_class.new(devicegraph, planned_devices, boot_disk_name)
    end

    # @see #strategy
    #
    # @return [BootRequirementsStrategies::Base]
    def strategy_class
      case bootloader
      when BootloaderType::NONE
        BootRequirementsStrategies::NfsRoot
      when BootloaderType::GRUB2
        grub2_strategy_class
      when BootloaderType::BLS_LEGACY
        BootRequirementsStrategies::BLS
      else
        BootRequirementsStrategies::BlsEfi
      end
    end

    # @see #strategy
    #
    # @return [BootRequirementsStrategies::Base]
    def grub2_strategy_class
      if nfs_root?
        BootRequirementsStrategies::NfsRoot
      elsif raspberry_pi?
        BootRequirementsStrategies::Raspi
      elsif arch.efiboot?
        BootRequirementsStrategies::UEFI
      elsif arch.s390?
        BootRequirementsStrategies::ZIPL
      elsif arch.ppc?
        BootRequirementsStrategies::PReP
      else
        # Fallback to Legacy as default
        BootRequirementsStrategies::Legacy
      end
    end

    # Whether the root filesystem is NFS
    #
    # @return [Boolean]
    def nfs_root?
      planned_nfs_root? || exist_nfs_root?
    end

    # Whether there is a planned NFS root
    #
    # @return [Boolean]
    def planned_nfs_root?
      planned_devices.find { |d| d.is_a?(Planned::Nfs) && d.mount_point == "/" }
    end

    # Whether a NFS root already exists
    #
    # @return [Boolean]
    def exist_nfs_root?
      devicegraph.nfs_mounts.any? { |i| i.mount_point&.root? }
    end

    # @see #raspberry_pi?
    VENDOR_MODEL_PATH = "/proc/device-tree/model"
    private_constant :VENDOR_MODEL_PATH

    # Whether this is a Raspberry Pi. See fate#323484
    #
    # @return [Boolean]
    def raspberry_pi?
      return false unless File.exist?(VENDOR_MODEL_PATH)

      File.read(VENDOR_MODEL_PATH).match?(/Raspberry Pi/i)
    end
  end
end
