# Copyright (c) [2023-2024] SUSE LLC
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

require "y2storage/proposal/space_maker_prospects"

module Y2Storage
  module Proposal
    module SpaceMakerActions
      # Classical YaST strategy for {SpaceMakerActions::List}, used by default and if the strategy
      # is configured as :auto.
      #
      # This is basically a wrapper around {SpaceMakerProspects::List}, since the original logic
      # was implemented there.
      class AutoStrategy
        # Constructor
        #
        # @param settings [ProposalSpaceSettings] proposal settings
        # @param disk_analyzer [DiskAnalyzer] information about existing partitions
        def initialize(settings, disk_analyzer)
          @settings = settings
          @disk_analyzer = disk_analyzer
          @prospects = SpaceMakerProspects::List.new(settings, disk_analyzer)
          @mandatory = []
        end

        # In the case of the traditional YaST strategy for making space, this corresponds to
        # deleting all partitions explicitly marked for removal in the proposal settings, i.e.
        # all the partitions belonging to one of the types with delete_mode set to :all.
        #
        # @see ProposalSettings#windows_delete_mode
        # @see ProposalSettings#linux_delete_mode
        # @see ProposalSettings#other_delete_mode
        #
        # @param disk [Disk] see {List}
        def add_mandatory_actions(disk)
          mandatory.concat(prospects.unwanted_partition_prospects(disk))
        end

        # @param disk [Disk] see {List}
        # @param volume_groups [Array<Planned::LvmVg>] LVM VGs to be potentially reused
        def add_optional_actions(disk, volume_groups)
          prospects.add_prospects(disk, volume_groups)
        end

        # @return [Action, nil] nil if there are no more actions in the list
        def next
          next_prospect&.action
        end

        # @param deleted_sids [Array<Integer>] see {List}
        def done(deleted_sids)
          if mandatory.any?
            mandatory.shift
            return
          end

          prospects.next_available_prospect.available = false
          prospects.mark_deleted(deleted_sids)
        end

        private

        # @return [Array<Action>] list of mandatory actions to be executed
        attr_reader :mandatory

        # @return [SpaceMakerProspects::List] optional actions to be executed if needed
        attr_reader :prospects

        # @see #next
        def next_prospect
          return @mandatory.first unless @mandatory.empty?

          prospects.next_available_prospect
        end
      end
    end
  end
end
