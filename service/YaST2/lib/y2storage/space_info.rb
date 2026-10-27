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

module Y2Storage
  # Information about free space on a device
  #
  # This is a wrapper for Storage::SpaceInfo
  class SpaceInfo
    include StorageClassWrapper
    wrap_class Storage::SpaceInfo

    # @!method size
    #   @return [DiskSize] total size of the device
    storage_forward :size, as: "DiskSize"

    # @!method used
    #   @return [DiskSize] used space of the device
    storage_forward :used, as: "DiskSize"

    # gets free space info. Basically it is total size minus used size
    # @return [DiskSize] free space of the device
    def free
      size - used
    end
  end
end
