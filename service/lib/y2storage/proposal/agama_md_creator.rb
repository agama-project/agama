# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "y2storage/proposal/agama_md_name"

module Y2Storage
  module Proposal
    # Auxiliary class to create new MD RAIDs
    #
    # @see AgamaDevicesCreator
    class AgamaMdCreator
      include AgamaMdName

      # Constructor
      #
      # @param devicegraph [Devicegraph] Devicegraph to be processed, will be modified
      # @param planned_devices [Planned::DevicesCollection] Full list of devices to create/reuse
      # @param creator_result [Proposal::CreatorResult] Current result, will be modified
      def initialize(devicegraph, planned_devices, creator_result)
        @devicegraph = devicegraph
        @planned_devices = planned_devices
        @creator_result = creator_result
      end

      # Creates an MD RAID (but not its partitions) in the devicegraph
      #
      # @param planned [Planned::Md]
      # @return [Md]
      def create(planned)
        md = Y2Storage::Md.create(devicegraph, md_device_name(planned, devicegraph))
        md.md_level = planned.md_level if planned.md_level
        md.chunk_size = planned.chunk_size if planned.chunk_size
        md.md_parity = planned.md_parity if planned.md_parity
        devices = md_members(planned)
        devices.map(&:remove_descendants)
        md.sorted_devices = devices
        if planned.partitions.empty?
          planned.format!(md)
        else
          # FIXME: This modifies the original planned device object. That looks like the safer
          # approach as a hotfix for bsc#1253145.
          planned.partitions.each { |p| p.disk = md.name }
        end

        creator_result.merge!(CreatorResult.new(devicegraph, md.name => planned))

        md
      end

    private

      # @return [Devicegraph] Current devicegraph
      attr_accessor :devicegraph

      # @return [Planned::DevicesCollection] Full list of devices to create/reuse
      attr_reader :planned_devices

      # @return [Planned::DevicesCollection] Current result
      attr_reader :creator_result

      # @see #create_md_raid
      #
      # @param planned_md [Planned::Md]
      # @return [Array<BlkDevice>] sorted list of members
      def md_members(planned_md)
        names = planned_devices
          .select { |d| d.respond_to?(:raid_name) && md_name_match?(planned_md, d) }
          .sort_by { |d| md_member_index(d) }
          .map { |d| planned_device_name(d) }
        names.map do |dev_name|
          device = Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name)
          device.encryption || device
        end
      end

      # Name of the device at the working devicegraph that corresponds to the given planned device
      #
      # @param planned [Planned::Device]
      # @return [String]
      def planned_device_name(planned)
        return planned.reuse_name if planned.reuse?

        creator_result.created_names { |d| d.planned_id == planned.planned_id }.first
      end
    end
  end
end
