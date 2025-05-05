# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require "y2storage/planned/devices_collection"
require "y2storage/proposal/agama_drive_planner"
require "y2storage/proposal/agama_vg_planner"
require "y2storage/proposal/agama_md_planner"

module Y2Storage
  module Proposal
    # Devices planner for Agama.
    class AgamaDevicesPlanner
      include Yast::Logger

      # @param devicegraph [Devicegraph]
      # @param issues_list [Array<Agama::Issue>]
      def initialize(devicegraph, issues_list)
        @devicegraph = devicegraph
        @issues_list = issues_list
      end

      # List of devices that need to be created to satisfy the settings. Does not include
      # devices needed for booting.
      #
      # For the time being, this only plans for drives, partitions, and new LVM volume groups.
      #
      # @param config [Agama::Storage::Config]
      # @return [Planned::DevicesCollection]
      def planned_devices(config)
        @partitionables = {}
        planned = planned_drives(config) + planned_mds(config) + planned_vgs(config)
        Planned::DevicesCollection.new(planned)
      end

    protected

      # @return [Y2Storage::Devicegraph]
      attr_reader :devicegraph

      # @return [Array<Agama::Issue>] List to register any found issue
      attr_reader :issues_list

      # @return [Hash] Map to track the planned devices
      attr_reader :partitionables

      # @param config [Agama::Storage::Config]
      # @return [Array<Planned::Device>]
      def planned_drives(config)
        config.drives.flat_map do |drive|
          planner = AgamaDrivePlanner.new(devicegraph, issues_list, partitionables)
          planner.planned_devices(drive, config)
        end
      end

      # @param config [Agama::Storage::Config]
      # @return [Array<Planned::Device>]
      def planned_mds(config)
        config.md_raids.flat_map do |raid|
          planner = AgamaMdPlanner.new(devicegraph, issues_list, partitionables)
          planner.planned_devices(raid, config)
        end
      end

      # @param config [Agama::Storage::Config]
      # @return [Array<Planned::Device>]
      def planned_vgs(config)
        config.volume_groups.flat_map do |vg|
          planner = AgamaVgPlanner.new(devicegraph, issues_list, partitionables)
          planner.planned_devices(vg)
        end
      end
    end
  end
end
