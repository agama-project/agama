# Copyright (c) [2018-2024] SUSE LLC
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

require "y2storage/proposal/space_maker_prospects/partition_prospect"

module Y2Storage
  module Proposal
    module SpaceMakerProspects
      # Represents the prospect action of deleting a given partition
      #
      # @see Base
      class DeletePartition < PartitionProspect
        # @param partition [Partition] partition to delete
        # @param disk_analyzer [DiskAnalyzer] see {#analyzer}
        # @param for_delete_all [Boolean] if the permissions are being checked
        #   as part of the first step which deletes unwanted partitions when the
        #   corresponding delete_mode is :all
        def initialize(partition, disk_analyzer, for_delete_all)
          @for_delete_all = for_delete_all
          super(partition, disk_analyzer)
          @partition_id = partition.id
        end

        # Type of the partition to be deleted, according to DiskAnalyzer
        #
        # @return [Symbol] :windows, :linux or :other
        def partition_type
          @partition_type ||=
            if analyzer.windows_partitions(disk_name).any? { |part| part.name == device_name }
              :windows
            elsif analyzer.linux_partitions(disk_name).any? { |part| part.name == device_name }
              :linux
            else
              :other
            end
        end

        # Whether performing the action would be acceptable
        #
        # @param settings [ProposalSettings]
        # @return [Boolean]
        def allowed?(settings)
          allowed = allowed_type?(settings, partition_type)
          if irst? && windows_in_disk? && allowed
            # Second line of defense for IRST partitions
            log.info "#{device_name} seems to be used by a Windows installation, double-checking"
            allowed_type?(settings, :windows)
          else
            allowed
          end
        end

        # Whether the action should be performed just as last resort to make
        # space, after having tried to delete all the other allowed partitions.
        #
        # In other words, DeletePartition prospects returning true for this should
        # only be considered when there is no available DeletePartition prospect
        # that returns false.
        #
        # @return [Boolean]
        def last_resort?
          irst?
        end

        # @return [String]
        def to_s
          "<#{sid} (#{device_name}) - #{partition_type}>"
        end

        private

        # @return [PartitionId]
        attr_reader :partition_id

        attr_reader :for_delete_all

        # Whether the partition is an Intel Rapid Start Technology partition
        #
        # @return [Boolean]
        def irst?
          partition_id.is?(:irst)
        end

        # @see #allowed?
        def allowed_type?(settings, type)
          if for_delete_all
            settings.delete_forced?(type)
          else
            !settings.delete_forbidden?(type)
          end
        end

        # @see #action
        def action_class
          SpaceMakerActions::Delete
        end
      end
    end
  end
end
