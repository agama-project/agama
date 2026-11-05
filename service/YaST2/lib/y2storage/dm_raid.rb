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
require "y2storage/partitionable"
require "y2storage/disk_device"
require "y2storage/multi_disk_device"

module Y2Storage
  # A DM RAID device
  #
  # This is a wrapper for Storage::DmRaid
  class DmRaid < Partitionable
    wrap_class Storage::DmRaid
    include DiskDevice
    include MultiDiskDevice

    # @!method rotational?
    #   @return [Boolean] whether this is a rotational device
    storage_forward :rotational?

    # @!method self.create(devicegraph, name, region_or_size = nil)
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @param region_or_size [Region, DiskSize]
    #   @return [DmRaid]
    storage_class_forward :create, as: "DmRaid"

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<DmRaid>] all the DM RAIDs in the given devicegraph,
    #     sorted by name
    storage_class_forward :all, as: "DmRaid"

    # @!method self.find_by_name(devicegraph, name)
    #   @param devicegraph [Devicegraph]
    #   @param name [String] only the name returned by #name is considered
    #   @return [DmRaid] nil if there is no such device
    storage_class_forward :find_by_name, as: "DmRaid"

    # Whether the RAID is defined by software
    #
    # @note DM RAIDS are not defined by sofware.
    #
    # @return [Boolean] false
    def software_defined?
      false
    end

    # return [String]
    def inspect
      "<DmRaid #{name} parents=#{parents}>"
    end

    protected

    # @see Device#is?
    def types_for_is
      types = super
      types << :dm_raid
      types << :raid
      types << :bios_raid
      types
    end
  end
end
