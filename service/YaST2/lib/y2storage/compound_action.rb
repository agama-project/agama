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
  # A complex action representing a set of related actions from an actiongraph
  #
  # This is a wrapper for Storage::CompoundAction
  class CompoundAction
    include StorageClassWrapper
    wrap_class Storage::CompoundAction

    # @!method target_device
    #   @return [Y2Storage::Device] device the actions are related to.
    storage_forward :target_device, as: "Device"

    # @!method sentence
    #   Localized description of the action, ready to be displayed to the user.
    #   @return [String]
    storage_forward :sentence

    # @!method delete?
    #   @return [Boolean] whether the action destroys the target device
    storage_forward :delete?

    # Checks whether the target device is a concrete kind of device.
    # @see Device#is?
    #
    # @param type [#to_sym] name of the device type, as defined in
    #   each subclass.
    # @return [Boolean]
    def device_is?(type)
      target_device.is?(type)
    end
  end
end
