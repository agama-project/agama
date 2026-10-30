# Copyright (c) [2017] SUSE LLC
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

require "y2storage/storage_class_wrapper"
require "y2storage/blk_device"

module Y2Storage
  # Class representing devices that have no parent in the devicegraph but cannot
  # be partitioned (they are not real disks or DASDs).
  #
  # Currently only Xen Virtual Partitions (e.g. /dev/xvda1) are represented as
  # stray block devices. Note that partitionable devices in Xen (e.g. /dev/xvda)
  # are represented as Disk objects and partitions on them as normal
  # Partition objects (e.g. also /dev/xvda1).
  #
  # @note: This class may dissapear in the future if the functionality is merged
  # into the Disk class (adding non-partitionable disks was considered too risky
  # in the development phase in which StrayBlkDevice was introduced). Don't
  # rely too much on this class.
  class StrayBlkDevice < BlkDevice
    wrap_class Storage::StrayBlkDevice

    # @!method self.create(devicegraph, name, region_or_size = nil)
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @param region_or_size [Region, DiskSize]
    #   @return [StrayBlkDevice]
    storage_class_forward :create, as: "StrayBlkDevice"

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<StrayBlkDevice>] all the stray devices in the given
    #     devicegraph, in no particular order
    storage_class_forward :all, as: "StrayBlkDevice"

    # @!method self.find_by_name(devicegraph, name)
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @return [StrayBlkDevice] nil if there is no such stray device
    storage_class_forward :find_by_name, as: "Dasd"

    # @return [String]
    def inspect
      "<StrayBlkDevice #{name} #{size}>"
    end

    protected

    # @see Device#is?
    def types_for_is
      types = super
      types << :stray_blk_device
      types << :stray
      types
    end
  end
end
