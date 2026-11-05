# Copyright (c) [2017-2021] SUSE LLC
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

require "y2storage/planned"
require "y2storage/disk_size"
require "y2storage/proposal/creator_result"
require "y2storage/proposal/lvm_space_maker"

module Y2Storage
  module Proposal
    # Class to create LVM volume groups and logical volumes following a
    # Planned::LvmVg object
    class LvmCreator
      include Yast::Logger

      # Default name for logical volumes
      DEFAULT_LV_NAME = "lv".freeze

      private_constant :DEFAULT_LV_NAME

      # @return [Devicegraph] initial devicegraph
      attr_reader :original_devicegraph

      # Constructor
      #
      # @param original_devicegraph [Devicegraph] Initial devicegraph
      # @param space_settings [ProposalSpaceSettings, nil] Optional settings to customize what to do
      #   with every existing logical volume. If omitted, the traditional YaST approach is used
      #   (ie. the strategy "auto" is used, see {LvmSpaceStrategies::Auto}).
      def initialize(original_devicegraph, space_settings = nil)
        @original_devicegraph = original_devicegraph
        @space_settings = space_settings
      end

      # Returns a copy of the original devicegraph in which the volume
      # group (and its logical volumes, if needed) have been created.
      #
      # @param planned_vg [Planned::LvmVg]   Volume group to create
      # @param pv_partitions [Array<String>] names of the newly created
      #   partitions that should be added as PVs to the volume group
      # @return [CreatorResult] result containing the planned volume group
      def create_volumes(planned_vg, pv_partitions = [])
        new_graph = original_devicegraph.duplicate
        vg =
          if planned_vg.reuse?
            find_vg(planned_vg, new_graph)
          else
            create_volume_group(planned_vg, new_graph)
          end

        assign_physical_volumes(vg, pv_partitions, new_graph)
        make_space(vg, planned_vg)
        devices_map = create_logical_volumes(vg, planned_vg.lvs)
        devices_map[vg.name] = planned_vg

        CreatorResult.new(new_graph, devices_map)
      end

      # Reuses logical volumes for the devicegraph
      #
      # @note This method does not modify the original devicegraph but returns
      #   a new copy containing the changes.
      #
      # @param planned_vg [Planned::LvmVg] Volume group
      # @return [CreatorResult] result containing the reused volumes
      def reuse_volumes(planned_vg)
        new_graph = original_devicegraph.duplicate
        planned_vg.reuse!(new_graph)
        vg = Y2Storage::LvmVg.find_by_vg_name(new_graph, planned_vg.reuse_name)
        reused_lvs = planned_lvs_in_vg(planned_vg.all_lvs.select(&:reuse?), vg)
        shrinking, not_shrinking = reused_lvs.partition { |v| v.shrink?(new_graph) }
        (shrinking + not_shrinking).each { |v| v.reuse!(new_graph) }
        CreatorResult.new(new_graph, {})
      end

      private

      # Find a volume group to be reused
      #
      # @param planned_vg  [Planned::LvmVg] Planned volume group marked as 'reused'
      # @param devicegraph [Devicegraph]    Devicegraph to find the real volume group
      # @return [LvmVg] Volume group to be reused
      def find_vg(planned_vg, devicegraph)
        devicegraph.lvm_vgs.find { |vg| vg.vg_name == planned_vg.reuse_name }
      end

      # Create a volume group in a devicegraph
      #
      # @param planned_vg  [Planned::LvmVg] Planned volume group
      # @param devicegraph [Devicegraph]    Starting point
      # @return [Devicegraph] New devicegraph containing the new volume group
      def create_volume_group(planned_vg, devicegraph)
        name = available_name(planned_vg.volume_group_name, devicegraph)
        vg = LvmVg.create(devicegraph, name)
        vg.extent_size = planned_vg.extent_size if planned_vg.extent_size
        vg
      end

      # Extends the given volume group by adding as physical volumes the
      # partitions in the given list.
      #
      # This method modifies the volume group received as first argument.
      #
      # @param volume_group [LvmVg] volume group to extend
      # @param part_names [Array<String>] device names of the partitions
      # @param devicegraph [Devicegraph] to fetch the partitions
      def assign_physical_volumes(volume_group, part_names, devicegraph)
        partitions = part_names.map { |n| BlkDevice.find_by_name(devicegraph, n) }
        used_devices = volume_group.lvm_pvs.map(&:plain_blk_device)
        partitions.each do |partition|
          next if used_devices.include?(partition) # already a PV for this VG

          device = partition.encryption || partition
          device.remove_descendants
          volume_group.add_lvm_pv(device)
        end
      end

      # Makes space for planned logical volumes
      #
      # This method modifies the volume group received as first argument.
      #
      # @param volume_group [LvmVg] volume group to clean-up
      # @param planned_vg   [Planned::LvmVg] planned logical volume
      def make_space(volume_group, planned_vg)
        space_maker = LvmSpaceMaker.new(volume_group, planned_vg, @space_settings)
        space_maker.provide_space
      end

      # Creates a logical volume for each planned volume.
      #
      # This method modifies the volume group received as first argument.
      #
      # @param volume_group [LvmVg] volume group to modify
      # @param planned_lvs [Array<Planned::LvmLv>] specification of the logical
      #   volumes to create inside the volume group
      # @return [Hash{String => Planned::LvmLv}] planned LVs indexed by the
      #   device name of the real LV devices that were created
      def create_logical_volumes(volume_group, planned_lvs)
        adjusted_lvs = planned_lvs_in_vg(planned_lvs, volume_group).reject(&:reuse?)
        vg_size = volume_group.available_space
        lvs = Planned::LvmLv.distribute_space(adjusted_lvs, vg_size, rounding: volume_group.extent_size)
        all_lvs = lvs + lvs.map(&:thin_lvs).flatten + thin_lvs_from_reused_pools(planned_lvs)
        all_lvs.reject(&:reuse?).each_with_object({}) do |planned_lv, devices_map|
          new_lv = create_logical_volume(volume_group, planned_lv)
          devices_map[new_lv.name] = planned_lv
        end
      rescue RuntimeError => e
        log.info "The logical volumes do not fit into the volume group: #{e}"
        raise NoDiskSpaceError
      end

      # Creates a logical volume in a volume group
      #
      # This method modifies the volume group received as first argument.
      #
      # @param volume_group [LvmVg] Volume group
      # @param planned_lv   [Planned::LvmLv] Planned logical volume to be used as reference
      #   for the new one
      # @return [LvmLv] Recently created logical volume
      def create_logical_volume(volume_group, planned_lv)
        name = planned_lv.logical_volume_name || DEFAULT_LV_NAME
        unique_name = available_name(name, volume_group)
        parent =
          if planned_lv.thin_pool
            volume_group.lvm_lvs.find { |v| v.lv_name == planned_lv.thin_pool.logical_volume_name }
          else
            volume_group
          end
        new_lv = parent.create_lvm_lv(unique_name, planned_lv.lv_type, planned_lv.real_size_in(parent))
        planned_lv.format!(new_lv)
        add_stripes_config(new_lv, planned_lv)
        new_lv
      end

      # Returns the name that is available taking original_name as a base. If
      # the name is already taken, the returned name will have a number
      # appended.
      #
      # @param original_name [String]
      # @param root [Devicegraph, LvmVg] if root is a devicegraph, the name is
      #   considered a VG name. If root is a VG, the name is for a logical
      #   volume.
      # @return [String]
      def available_name(original_name, root)
        return original_name unless name_taken?(original_name, root)

        suffix = 0
        name = "#{original_name}#{suffix}"
        while name_taken?(name, root)
          suffix += 1
          name = "#{original_name}#{suffix}"
        end
        name
      end

      # Determines whether a name for a LV or a VG is already taken
      #
      # If a Devicegraph is given as {root}, it will search for a volume group
      # named like {name}. On the other hand, it will assume that the {root}
      # is a LvmVg and it will search for a volume group.
      #
      # @param name [String]      Name to check
      # @param root [Devicegraph,LvmVg] Scope to search for the name
      def name_taken?(name, root)
        if root.is_a? Devicegraph
          root.lvm_vgs.any? { |vg| vg.vg_name == name }
        else
          root.lvm_lvs.any? { |lv| lv.lv_name == name }
        end
      end

      # Returns a list of planned logical volumes adjusting the size
      #
      # All logical volumes which sizes are specified as a percentage will get
      # their minimal and maximal sizes adjusted.
      #
      # @param lvs [Array<Planned::LvmLv>] List of planned logical volumes
      # @param vg  [Planned::LvmVg]        Volume group to place logical volumes on
      # @return [Array<Planned::LvmLv] New list of planned logical volumes with adjusted sizes
      def planned_lvs_in_vg(lvs, vg)
        lvs.map do |lv|
          new_lv = lv.clone
          next new_lv unless new_lv.percent_size

          new_lv.max = new_lv.min = lv.size_in(vg)
          new_lv
        end
      end

      # Returns a list of planned logical thin volumes that should be created in thin pools
      # that already exist.
      #
      # @param lvs [Array<Planned::LvmLv>] List of planned logical volumes
      # @return [Array<Planned::LvmLv]
      def thin_lvs_from_reused_pools(lvs)
        lvs.select(&:reuse?).flat_map(&:thin_lvs)
      end

      # Helper method to set stripes attributes
      #
      # @param lv         [LvmLv] Logical volume
      # @param planned_lv [LvmLv] Planned logical volume
      def add_stripes_config(lv, planned_lv)
        lv.stripes = planned_lv.stripes if planned_lv.stripes
        lv.stripe_size = planned_lv.stripe_size if planned_lv.stripe_size

        # The size of the new LV is rounded-down according to the extent size and the number of stripes,
        # see bsc#1180723.
        lv.size = lv.rounded_size
      end
    end
  end
end
