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

        # What to do if the search does not match with the expected number of devices
        # @return [Symbol] :create, :skip or :error
        attr_accessor :if_not_found

        # Constructor
        def initialize
          @if_not_found = :skip
        end

        # Whether {#find} was already called
        #
        # @return [Boolean]
        def resolved?
          !!@resolved
        end

        # Whether the section containing the search should be skipped
        #
        # @return [Boolean]
        def skip_device?
          resolved? && device.nil? && if_not_found == :skip
        end

        # Resolve the search, associating the corresponding device to {#device}
        #
        # @param candidate_devs [Array<Y2Storage::Device>] candidate devices
        # @param used_sids [Array<Integer>] SIDs of the devices that are already used elsewhere
        def find(candidate_devs, used_sids)
          devices = candidate_devs.reject { |d| used_sids.include?(d.sid) }
          @resolved = true
          @device = devices.min_by(&:name)
        end
      end
    end
  end
end
