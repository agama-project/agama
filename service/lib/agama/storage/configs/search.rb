# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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
        # Search config meaning "search all".
        #
        # @return [Configs::Search]
        def self.new_for_search_all
          new.tap { |c| c.if_not_found = :skip }
        end

        # Search by name.
        #
        # @return [String, nil]
        attr_accessor :name

        # Search by size.
        #
        # @return [SearchConditions::Size, nil]
        attr_accessor :size

        # Search by partition number (only applies if searching partitions).
        #
        # @return [Integer, nil] e.g., 2 for "/dev/vda2".
        attr_accessor :partition_number

        # Found device, if any
        #
        # @return [Y2Storage::Device, nil]
        attr_reader :device

        # What to do if the search does not match with the expected number of devices
        # @return [:create, :skip, :error]
        attr_accessor :if_not_found

        # Optional max number of devices to match
        #
        # return [Integer, nil] nil means no limit, ie. all devices that meet the condition are
        #   matched
        attr_accessor :max

        # return [Array<SortCriteria::Base>]
        attr_accessor :sort_criteria

        # Constructor
        def initialize
          @solved = false
          @if_not_found = :error
          @sort_criteria = []
        end

        # Whether the search was already solved.
        #
        # @return [Boolean]
        def solved?
          @solved
        end

        # Solves the search with the given device.
        #
        # @param device [Y2Storage::Device, nil]
        def solve(device = nil)
          @device = device
          @solved = true
        end

        # Whether the search defines any condition.
        #
        # @return [Boolean]
        def condition?
          condition = name || size || partition_number
          !condition.nil?
        end

        # Whether the section containing the search should be skipped
        #
        # @return [Boolean]
        def skip_device?
          solved? && device.nil? && if_not_found == :skip
        end

        # Whether the device is not found and it has to be created.
        #
        # @return [Boolean]
        def create_device?
          solved? && device.nil? && if_not_found == :create
        end
      end
    end
  end
end
