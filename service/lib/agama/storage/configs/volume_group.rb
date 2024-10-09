# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

module Agama
  module Storage
    module Configs
      # Section of the configuration representing a LVM volume group.
      class VolumeGroup
        # @return [String, nil]
        attr_accessor :name

        # @return [Y2Storage::DiskSize, nil]
        attr_accessor :extent_size

        # Aliases of the devices used for automatically creating new physical volumes.
        #
        # @return [Array<String>]
        attr_accessor :physical_volumes_devices

        # Encryption for the new physical volumes created at the {physical_volumes_devices}.
        #
        # @return [Encryption, nil]
        attr_accessor :physical_volumes_encryption

        # Aliases of the devices used as physical volumes.
        #
        # @return [Array<String>]
        attr_accessor :physical_volumes

        # @return [Array<LogicalVolume>]
        attr_accessor :logical_volumes

        def initialize
          @physical_volumes_devices = []
          @physical_volumes = []
          @logical_volumes = []
        end
      end
    end
  end
end
