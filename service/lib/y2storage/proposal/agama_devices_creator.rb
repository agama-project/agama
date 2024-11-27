# frozen_string_literal: true

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

require "y2storage/exceptions"
require "y2storage/proposal/lvm_creator"
require "y2storage/proposal/partition_creator"

module Y2Storage
  module Proposal
    # Class to create and reuse devices during the Agama proposal
    class AgamaDevicesCreator
      include Yast::Logger

      # @return [Array<Agama::Issue>] List of found issues
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
      # @param space_maker [SpaceMaker]
      #
      # @return [CreatorResult] Result with new devicegraph in which all the
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

      # @return [SpaceMaker] space maker to use during operation
      attr_reader :space_maker

      # @return [Proposal::CreatorResult] Current result containing the devices that have been
      #   created
      attr_reader :creator_result

      # @return [Devicegraph] Current devicegraph
      attr_accessor :devicegraph

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
      # @return [CreatorResult] Result with new devicegraph in which all the
      #   planned devices have been allocated
      def process_devices
        process_existing_partitionables
        process_volume_groups

        # This may be unexpected if the storage configuration provided by the user includes
        # carefully crafted mount options but may be needed in weird situations for more automated
        # proposals. Let's re-evaluate over time.
        devicegraph.mount_points.each(&:adjust_mount_options)

        creator_result
      end

      # @see #process_devices
      def process_existing_partitionables
        partitions = partitions_for_existing(planned_devices)

        begin
          # Check whether there is any chance of getting an unwanted order for the planned
          # partitions within a disk
          space_result = space_maker.provide_space(
            original_graph, partitions: partitions, volume_groups: automatic_vgs
          )
        rescue Error => e
          log.info "SpaceMaker was not able to find enough space: #{e}"
          raise NoDiskSpaceError
        end

        self.devicegraph = space_result[:devicegraph]
        distribution = space_result[:partitions_distribution]

        grow_and_reuse_devices(distribution)
        self.creator_result = PartitionCreator.new(devicegraph).create_partitions(distribution)
      end

      # @see #process_devices
      def process_volume_groups
        # TODO: Reuse volume groups.
        planned_devices.vgs.map { |v| create_volume_group(v) }
      end

      # Planned volume groups for which the proposal must automatically create the needed physical
      # volumes
      #
      # @return [Array<Planned::LvmVg>]
      def automatic_vgs
        planned_devices.select do |dev|
          dev.is_a?(Planned::LvmVg) && dev.pvs_candidate_devices.any?
        end
      end

      # Creates a volume group for the the given planned device.
      #
      # @param planned [Planned::LvmVg]
      def create_volume_group(planned)
        pv_names = physical_volumes_for(planned.volume_group_name)
        # TODO: Generate issue if there are no physical volumes.
        return if pv_names.empty?

        creator = Proposal::LvmCreator.new(creator_result.devicegraph)
        new_result = creator.create_volumes(planned, pv_names)
        self.creator_result = creator_result.merge(new_result)
      end

      # Physical volumes (new partitions and reused devices) for a new volume group.
      #
      # @param vg_name [String]
      # @return [Array<String>]
      def physical_volumes_for(vg_name)
        pv_condition = proc { |d| d.respond_to?(:pv_for?) && d.pv_for?(vg_name) }

        new_pvs = creator_result.created_names(&pv_condition)
        reused_pvs = reused_planned_devices
          .select(&pv_condition)
          .map(&:reuse_name)

        new_pvs + reused_pvs
      end

      # @see #process_existing_partitionables
      def grow_and_reuse_devices(distribution)
        planned_devices.select(&:reuse?).each do |planned|
          space = assigned_space_next_to(planned, distribution)

          planned.limit_grow(space.disposable_size, devicegraph) if space
          planned.reuse!(devicegraph)
          # TODO: Check if the final size is smaller than the min and... abort? register issue?
          space&.update_disk_space
        end
      end

      # Assigned space that is located next to the given planned device, only if that device
      # points to an existing partition that needs to grow
      #
      # @return [Y2Storage::Planned::AssignedSpace]
      def assigned_space_next_to(planned, distribution)
        return unless planned.respond_to?(:subsequent_slot?)
        return unless planned.resize?

        distribution.spaces.find { |s| planned.subsequent_slot?(s) }
      end

      # @see #process_existing_partitionables
      def partitions_for_existing(planned_devices)
        # Maybe in the future this can include partitions on top of existing MDs
        # NOTE: simplistic implementation
        planned_devices.partitions.reject(&:reuse?)
      end

      # Planned devices configured to be reused.
      #
      # @return [Array<Planned::Device>]
      def reused_planned_devices
        planned_devices.disks.select(&:reuse?) +
          planned_devices.disks.flat_map(&:partitions).select(&:reuse?)
      end

      # Formats and/or mounts the disk-like block devices
      #
      # XEN partitions (StrayBlkDevice) are intentionally left out for now
      #
      # Add planned disks to reuse list so they can be considered for lvm and raids later on.
      def process_disk_like_devs
        # Do we do something about SpaceMaker here? I assume it was already done as mandatory
        planned_devs = planned_devices.select { |d| d.is_a?(Planned::Disk) }
        planned_devs.each { |d| d.reuse!(devicegraph) }
      end
    end
  end
end
