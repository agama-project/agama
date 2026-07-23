# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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

require "agama/storage/configs/search_conditions"

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

        # Condition used to match devices.
        #
        # It holds the root node of the condition tree, which can be a leaf condition
        # (SearchConditions::Name, ::Size or ::PartitionNumber) or a logical operator
        # (SearchConditions::And, ::Or or ::Not) nesting other conditions.
        #
        # @return [SearchConditions::Name, SearchConditions::Size,
        #   SearchConditions::PartitionNumber, SearchConditions::And,
        #   SearchConditions::Or, SearchConditions::Not, nil]
        attr_accessor :condition

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
          !condition.nil?
        end

        # Name targeted by the search, if the top-level condition searches by name.
        #
        # Only a top-level SearchConditions::Name yields a name; operators (and/or/not) and
        # other leaf conditions (size, partition number) return nil.
        #
        # @return [String, nil]
        def condition_name
          return unless condition.is_a?(SearchConditions::Name)

          condition.name
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
