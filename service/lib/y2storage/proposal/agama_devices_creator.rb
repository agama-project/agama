# Copyright (c) [2017-2020] SUSE LLC
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

require "y2storage/proposal/agama_lvm_helper"
require "y2storage/exceptions"

module Y2Storage
  module Proposal
    # Class to create and reuse devices during the Agama proposal
    class AgamaDevicesCreator
      include Yast::Logger

      # @return [AutoinstIssues::List] List of found AutoYaST issues
      attr_reader :issues_list

      # Constructor
      #
      # @param original_graph [Devicegraph] Devicegraph to be used as starting point
      # @param issues_list [Array<Agama::Issue>] List of issues to register the problems
      #    found during devices creation
      def initialize(original_graph, issues_list)
        @original_graph = original_graph
        @issues_list = issues_list
      end

      # Devicegraph including all the specified planned devices
      #
      # @param planned_devices [Planned::DevicesCollection] Devices to create/reuse
      # @param disk_names [Array<String>] Disks to consider
      #
      # @return [AutoinstCreatorResult] Result with new devicegraph in which all the
      #   planned devices have been allocated
      def populated_devicegraph(planned_devices, disk_names, space_maker)
        # Process planned partitions
        log.info "planned devices = #{planned_devices.to_a.inspect}"
        log.info "disk names = #{disk_names.inspect}"

        reset

        @planned_devices = planned_devices
        @disk_names = disk_names
        @space_maker = space_maker

        process_devices
      end

      protected

      # @return [Devicegraph] Original devicegraph
      attr_reader :original_graph

      # @return [Planned::DevicesCollection] Devices to create/reuse
      attr_reader :planned_devices

      # @return [Array<String>] Disks to consider
      attr_reader :disk_names

      attr_reader :space_maker

      # @return [Proposal::CreatorResult] Current result containing the devices that have been created
      attr_reader :creator_result

      # @return [Devicegraph] Current devicegraph
      attr_reader :devicegraph

      private

      # Sets the current creator result
      #
      # The current devicegraph is properly updated.
      #
      # @param result [Proposal::CreatorResult]
      def creator_result=(result)
        @creator_result = result
        @devicegraph = result.devicegraph
      end

      # Resets values before create devices
      #
      # @see #populated_devicegraph
      def reset
        @creator_result = nil
        @devicegraph = original_graph.duplicate
      end

      # Reuses and creates planned devices
      #
      # @return [AutoinstCreatorResult] Result with new devicegraph in which all the
      #   planned devices have been allocated
      def process_devices
        process_existing_partitionables
        creator_result
      end

      def process_existing_partitionables
        partitions = partitions_for_existing(planned_devices)

        # lvm_lvs = system_lvm_over_existing? ? system_lvs(planned_devices) : []
        lvm_lvs = []
        lvm_helper = AgamaLvmHelper.new(lvm_lvs)

        # Check whether there is any chance of getting an unwanted order for the planned partitions
        # within a disk
        space_result = provide_space(partitions, original_graph, lvm_helper)

        partition_creator = PartitionCreator.new(space_result[:devicegraph])
        self.creator_result = partition_creator.create_partitions(space_result[:partitions_distribution])

        # This may be here or before create_partitions.
        #
        # What about resizing if needed?
        # Likely shrinking is fine and should be always handled at the SpaceMaker. 
        # But I'm not so sure if growing is so fine (we may need to make some space first).
        # I don't think we have the growing case covered by SpaceMaker, the distribution
        # calculator, etc.
        #
        planned_devices.each do |planned|
          next unless planned.reuse?

          planned.reuse!(devicegraph)
        end

        # graph = create_separate_vgs(planned_devices, creator_result).devicegraph

        # if settings.use_lvm
        #  new_pvs = new_physical_volumes(space_result[:devicegraph], graph)
        #  graph = lvm_helper.create_volumes(graph, new_pvs)
        #end

        # Needed or already part of other components?
        # graph.mount_points.each(&:adjust_mount_options)
      end

      def provide_space(planned_partitions, devicegraph, lvm_helper)
        result = space_maker.provide_space(devicegraph, planned_partitions, lvm_helper)
        log.info "Found enough space"
        result
      end

      def partitions_for_existing(planned_devices)
        # Maybe in the future this can include partitions on top of existing MDs
        # TODO: simplistic implementation
        planned_devices.partitions.reject(&:reuse?)
      end

      # Formats and/or mounts the disk like block devices (Xen virtual partitions and full disks)
      #
      # Add planned disk like devices to reuse list so they can be considered for lvm and raids
      # later on.
      def process_disk_like_devs
      # Do we do something about SpaceMaker here? I assume it was already done as mandatory
        planned_devs = planned_devices.select do |dev|
          dev.is_a?(Planned::StrayBlkDevice) || dev.is_a?(Planned::Disk)
        end

        planned_devs.each { |d| d.reuse!(devicegraph) }
      end
    end
  end
end
