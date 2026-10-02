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
require "y2storage/md"

module Y2Storage
  # MD Container
  #
  # This is a wrapper for Storage::MdContainer
  #
  # Some BIOS RAIDs (IMSM and DDF) can be handled by mdadm as MD RAIDs. For each of
  # these RAIDs a container device exists in the system ({MdContainer} class).
  # The RAIDs inside the container have type {MdMember}.
  #
  # MD Containers must not be used as a block devices.
  class MdContainer < Md
    wrap_class Storage::MdContainer

    # @!method self.create(devicegraph, name)
    #   @param devicegraph [Devicegraph]
    #   @param name [String] name of the new device, like "/dev/imsm0"
    #   @return [MdMember]
    storage_class_forward :create, as: "MdContainer"

    # @!method md_members
    # @return [Array<MdMember>]
    storage_forward :md_members, as: "MdMember"

    # All Md Containers in the given devicegraph
    #
    # @param devicegraph [Devicegraph]
    # @return [Array<MdContainer>]
    def self.all(devicegraph)
      super.select { |d| d.is?(:md_container) }
    end

    # Whether the RAID is defined by software
    #
    # @note MD Containers are not defined by software.
    #
    # @return [Boolean] false
    def software_defined?
      false
    end

    protected

    # Objects of this class are not considered RAIDs at all
    def types_for_is
      types = super

      types.delete(:disk_device)
      types.delete(:raid)
      types.delete(:bios_raid)
      types.delete(:software_raid)

      types << :md_container
      types
    end
  end
end
