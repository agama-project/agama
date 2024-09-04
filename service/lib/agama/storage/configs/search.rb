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
      # Configuration used to match drives, partitions and other device definition with devices
      # from the initial devicegraph
      class Search
        # Found device, if any
        # @return [Y2Storage::Device, nil]
        attr_reader :device

        # Name of the device to find.
        # @return [String, nil]
        attr_accessor :name

        # What to do if the search does not match with the expected number of devices
        # @return [:create, :skip, :error]
        attr_accessor :if_not_found

        # Constructor
        def initialize
          @if_not_found = :error
        end

        # Whether the search does not define any specific condition.
        #
        # @return [Boolean]
        def any_device?
          name.nil?
        end

        # Whether the search was already resolved.
        #
        # @return [Boolean]
        def resolved?
          !!@resolved
        end

        # Resolves the search with the given device.
        #
        # @param device [Y2Storage::Device, nil]
        def resolve(device = nil)
          @device = device
          @resolved = true
        end

        # Whether the section containing the search should be skipped
        #
        # @return [Boolean]
        def skip_device?
          resolved? && device.nil? && if_not_found == :skip
        end
      end
    end
  end
end
