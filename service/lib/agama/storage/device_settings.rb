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
    # Module for the settings to configure the device of the Agama storage proposal.
    module DeviceSettings
      # Class to be used when the target device is a disk.
      class Disk
        # Name of the device to use.
        #
        # @return [String, nil]
        attr_accessor :name

        # @param name [String, nil]
        def initialize(name = nil)
          @name = name
        end
      end

      # Class to be used when the target device is a reused LVM volume group.
      class ReusedLvmVg
        # Name of the LVM volume group to reuse.
        #
        # @return [String, nil]
        attr_accessor :name

        # @param name [String, nil]
        def initialize(name = nil)
          @name = name
        end
      end

      # Class to be used when the target device is a new LVM volume group.
      class NewLvmVg
        # List of candidate devices to create physical volumes.
        #
        # @return [Array<String>]
        attr_accessor :candidate_pv_devices

        # @param candidates [Array<String>]
        def initialize(candidates = [])
          @candidate_pv_devices = candidates
        end
      end
    end
  end
end
