# Copyright (c) [2018] SUSE LLC
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

require "y2storage"
require "y2storage/proposal/device_shrinkage"
require "y2storage/planned/devices_collection"
require "forwardable"

module Y2Storage
  module Proposal
    # Result of executing {Proposal::AutoinstDevicesCreator}. This class
    # extends the original {Proposal::CreatorResult} with some AutoYaST related
    # information.
    #
    # @see CreatorResult
    class AutoinstCreatorResult
      extend Forwardable

      def_delegators :@creator_result, :created_names, :devices_map, :devicegraph

      # Constructor
      #
      # @param creator_result  [CreatorResult] Original creator result object
      # @param planned_devices [Array<Planned::Device>] Planned devices
      def initialize(creator_result, planned_devices)
        @creator_result = creator_result
        @devices_collection = Planned::DevicesCollection.new(planned_devices)
      end

      # Return a list containing information about shrinked partitions
      #
      # @return [Array<DeviceShrinkage>] Partitions shrinkage details
      def shrinked_partitions
        @shrinked_partitions ||= shrinked_devices(devices_collection.partitions)
      end

      # Return a list containing information about shrinked logical volumes
      #
      # @return [Array<DeviceShrinkage>] Logical volumes shrinkage details
      def shrinked_lvs
        @shrinked_lvs ||= shrinked_devices(devices_collection.lvs)
      end

      # Calculate how much space is missing
      #
      # @return [DiskSize]
      def missing_space
        meth = shrinked_partitions.empty? ? :shrinked_lvs : :shrinked_partitions
        diffs = public_send(meth).map(&:diff)
        Y2Storage::DiskSize.sum(diffs)
      end

      # Using the planned_id of a planned device, find the corresponding one in the devicegraph
      #
      # @param planned_id [String] Planned device planned_id
      # @return [Y2Storage::BlkDevice] Device in the devicegraph which corresponds to the
      #   planned device identified by planned_id
      def real_device_by_planned_id(planned_id)
        name, _planned = devices_map.find { |_n, d| d.planned_id == planned_id }
        return nil unless name

        Y2Storage::BlkDevice.find_by_name(devicegraph, name)
      end

      # @return [Array<Planned::Device>] List of originally planned devices
      def planned_devices
        devices_collection.to_a
      end

      private

      # @return [DevicesCollection] Planned devices collection
      attr_reader :devices_collection

      # Return a list of DeviceShrinkage objects for a given collection
      #
      # Any device which has not been shrinked will be filtered out.
      #
      # @param collection [Array<Y2Storage::Planned::Partition>,Array<Y2Storage::Planned::LvmLv>]
      # @return [Array<Y2Storage::DeviceShrinkage>]
      def shrinked_devices(collection)
        collection.each_with_object([]) do |device, all|
          real_device = real_device_by_planned_id(device.planned_id)
          next if real_device.nil? || real_device.size.to_i >= device.min_size.to_i

          all << DeviceShrinkage.new(device, real_device)
        end
      end
    end
  end
end
