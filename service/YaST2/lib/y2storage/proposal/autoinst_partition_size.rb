# Copyright (c) [2019] SUSE LLC
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

module Y2Storage
  module Proposal
    # Mixin with methods used to calculate the min size, max size and weight of
    # a set of partitions which sizes are initially specified as AutoYaST sizes.
    module AutoinstPartitionSize
      # Returns a list of planned partitions adjusting the size
      #
      # All partitions which sizes are specified as percentage will get their minimal and maximal
      # sizes adjusted.
      #
      # If a device is provided as argument, it is considered that the
      # partitions will be all created in such device. If not, a devicegraph
      # must be provided and the device for each partition will be searched in
      # the devicegraph using the corresponding #{Planned::Partition#disk}
      # attribute.
      #
      # @raise [ArgumentError] if no device or devicegraph is provided.
      #
      # @param planned_partitions [Array<Planned::Partition>] List of planned partitions
      # @param device [Partitionable, nil] concrete device to partition, if any
      # @param devicegraph [Devicegraph, nil] devicegraph to look up the devices, if no
      #     concrete device is provided
      # @return [Array<Planned::Partition>] New list of planned partitions with adjusted sizes
      def sized_partitions(planned_partitions, device: nil, devicegraph: nil)
        raise ArgumentError, "Provide a device or a devicegraph" if !(device || devicegraph)

        planned_partitions.map do |part|
          new_part = part.clone
          next new_part unless new_part.percent_size

          dev = device || devicegraph.find_by_name(part.disk)
          new_part.max = new_part.min = new_part.size_in(dev)
          new_part
        end
      end

      # Return a list of new planned devices with flexible limits
      #
      # The min_size is removed and a proportional weight is set for every device.
      #
      # @param devices [Array<Planned::Partition>] initial list of planned devices
      # @return [Array<Planned::Partition>]
      def flexible_partitions(devices)
        devices.map do |device|
          new_device = device.clone
          new_device.weight = device.min_size.to_i
          new_device.min_size = DiskSize.B(1)
          new_device
        end
      end
    end
  end
end
