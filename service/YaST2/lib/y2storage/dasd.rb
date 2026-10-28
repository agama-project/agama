# Copyright (c) [2017-2023] SUSE LLC
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

module Y2Storage
  # A DASD (direct-access storage device), typically used in mainframes
  #
  # This is a wrapper for Storage::Dasd
  class Dasd < Partitionable
    wrap_class Storage::Dasd
    include DiskDevice

    # @!method rotational?
    #   @return [Boolean] whether this is a rotational device
    storage_forward :rotational?

    # @!method bus_id
    #   @return [String] The bus ID of the DASD (e.g., "0.0.0150")
    storage_forward :bus_id

    # @!method type
    #   @return [DasdType]
    storage_forward :type, as: "DasdType"
    storage_forward :type=

    # @!method format
    #   @return [DasdFormat]
    storage_forward :format, as: "DasdFormat"
    storage_forward :format=

    # @!method self.create(devicegraph, name, region_or_size = nil)
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @param region_or_size [Region, DiskSize]
    #   @return [Dasd]
    storage_class_forward :create, as: "Dasd"

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<Dasd>] all the DASDs in the given devicegraph,
    #     in no particular order
    storage_class_forward :all, as: "Dasd"

    # @!method self.find_by_name(devicegraph, name)
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @return [Dasd] nil if there is no such DASD device
    storage_class_forward :find_by_name, as: "Dasd"

    def inspect
      "<Dasd #{name} #{size}>"
    end

    # DASD disks cannot be usb
    #
    # @return [Boolean]
    def usb?
      false
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :dasd
    end
  end
end
