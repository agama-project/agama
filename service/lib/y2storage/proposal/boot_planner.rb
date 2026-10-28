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
require "y2storage/boot_requirements_checker"
require "y2storage/storage_manager"
require "y2storage/bootloader_type"

module Y2Storage
  module Proposal
    # Class to calculate the partitions that will be needed to boot the system in the Agama
    # proposal, according to the Agama settings
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

        checker = BootRequirementsChecker.new(
          devicegraph,
          planned_devices: planned_devices,
          boot_disk_name:  boot_device_name,
          bootloader:      bootloader_config.type
        )
        different_plans(checker)
      rescue BootRequirementsChecker::Error => e
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

      # @see #plans
      #
      # This ensures that only one attempt is done if the plans for desired and min size are the
      # same, which happens with some boot requirement strategies.
      #
      # @return [Array<Array<Planned::Partition>>]
      def different_plans(checker)
        plans = [:desired, :min].map do |target|
          checker.needed_partitions(target)
        end

        return plans[0, 1] if equivalent_plans?(plans.first, plans.last)

        plans
      end

      # @see #different_plans
      #
      # @return [Boolean]
      def equivalent_plans?(plan_a, plan_b)
        # The only possible difference between two plans for the same situation (:desired vs :min)
        # is the size of the boot partitions
        plan_a.map(&:min_size) == plan_b.map(&:min_size)
      end
    end
  end
end
