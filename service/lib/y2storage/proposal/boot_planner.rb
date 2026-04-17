# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

module Y2Storage
  module Proposal
    # Class to calculate the partitions that will be needed to boot the system in the Agama
    # proposal, according to the Agama settings
    #
    # TODO: Currently this class overlaps some of its reponsibilities (and even logic!) with
    # Y2Storage::BootRequirementsChecker. We need to re-evaluate that before merging everything
    # to the master branch of Agama. It would likely make sense to make BootRequirementsChecker
    # more configurable instead of directly using its strategies in this class.
    class BootPlanner
      include Yast::Logger

      # Constructor
      #
      # @param devicegraph [Devicegraph]
      # @param config [Agama::Storage::Config]
      # @param bootloader_config [Agama::Storage::BootloaderConfig]
      def initialize(devicegraph, config, bootloader_config)
        @devicegraph = devicegraph
        @config = config
        @bootloader_config = bootloader_config
      end

      # Candidate sets of partitions needed in order to be able to boot the system
      #
      # @raise [NotBootableError] if adding partitions is not enough to make the system bootable
      #
      # @param planned_devices [Array<Planned::Device>] devices that are already planned to be
      #   added to the starting devicegraph.
      # @return [Array<Array<Planned::Partition>>]
      def plans(planned_devices)
        return [[]] unless config.boot.configure?

        strategy = strategy(planned_devices)
        [:desired, :min].map do |target|
          strategy.needed_partitions(target)
        end
      rescue BootRequirementsStrategies::Error => e
        raise NotBootableError, e.message
      end

    protected

      # @return [Devicegraph] starting situation.
      attr_reader :devicegraph

      # @return [Agama::Storage::Config]
      attr_reader :config

      # @return [Agama::Storage::BootloaderConfig]
      attr_reader :bootloader_config

      # Name of the boot device.
      #
      # @return [String, nil]
      def boot_device_name
        config.boot_device&.found_device&.name
      end

      # @see #partitions
      def strategy(planned_devices)
        strategy_class.new(devicegraph, planned_devices, boot_device_name)
      end

      # @see #grub2_strategy_class
      def arch
        @arch ||= StorageManager.instance.arch
      end

      # @see #strategy
      #
      # @return [BootRequirementsStrategies::Base]
      def strategy_class
        @strategy_class ||=
          case bootloader_config.type
          when Agama::Storage::BootloaderType::NONE
            BootRequirementsStrategies::NfsRoot
          when Agama::Storage::BootloaderType::GRUB2
            grub2_strategy_class
          else
            BootRequirementsStrategies::BLS
          end
      end

      # @see #strategy
      #
      # @return [BootRequirementsStrategies::Base]
      def grub2_strategy_class
        if raspberry_pi?
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
end
