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

module Y2Storage
  module Proposal
    # Utility used by PartitionsDistributionCalculator to propose some potential LVM physical
    # volumes during resize calculation, using a pessimistic heuristic.
    class ResizePhysVolCalculator
      # Initialize.
      #
      # @param disk_spaces [Array<FreeDiskSpace>] Spaces that could potentially contain physical
      #   volumes for the volume groups and that are located at the same disk than the partition
      #   being resized
      # @param planned_vgs [Array<Planned::LvmVg>] volume group to create the PVs for
      # @param disk_partitions [Array<Planned::Partition>] partitions (apart from the PVs) that
      #   also need to be located at the given spaces
      def initialize(disk_spaces, planned_vgs, disk_partitions)
        @disk_spaces = disk_spaces
        @planned_vgs = planned_vgs
        @disk_partitions = disk_partitions
      end

      # Whether it makes sense to use the result of {#all_partitions}
      #
      # @return [Boolean] false if this heuristic would be equivalent to the simplest one of
      #   adding one big PV per volume group
      def useful?
        space_sizes.any?
      end

      # A new set of planned partitions including physical volumes for the planned volume groups
      #
      # @return [Array<Planned::Partition>
      def all_partitions
        partitions = disk_partitions
        spaces_idx = space_sizes.length - 1
        space_remaining = space_sizes[spaces_idx]

        sorted_vgs.each do |vg|
          vg_missing = vg.missing_space

          while spaces_idx >= 0 && vg_missing > Y2Storage::DiskSize.zero
            useful_space = vg.useful_pv_space(space_remaining)

            if useful_space <= Y2Storage::DiskSize.zero
              spaces_idx -= 1
              space_remaining = space_sizes[spaces_idx] if spaces_idx >= 0
              next
            end

            assigned = [vg_missing, useful_space].min
            partitions << vg.single_pv_partition(target: assigned)
            vg_missing -= assigned
            space_remaining -= vg.real_pv_size(assigned)

            break if vg_missing.zero?
          end

          partitions << vg.single_pv_partition(target: vg_missing) unless vg_missing.zero?
        end

        partitions
      end

      private

      # See documentation of the constructor
      attr_reader :disk_spaces

      # See documentation of the constructor
      attr_reader :planned_vgs

      # See documentation of the constructor
      attr_reader :disk_partitions

      # Parts of the disk spaces that can be used to allocate physical volumes
      #
      # @return [Array<DiskSize>]
      def space_sizes
        return @space_sizes if @space_sizes

        # Use start_offset to ensure stable sorting
        spaces = disk_spaces.reject(&:growing?).sort_by { |s| [s.disk_size, s.start_offset] }
        parts_space = DiskSize.sum(disk_partitions.map(&:min), rounding: align_grain)

        # Very pesimistic, substract the size of all partitions from ALL spaces
        @space_sizes = spaces.map { |s| s.disk_size - parts_space }.reject(&:zero?)
      end

      # Alignment of the disk that is being processed
      #
      # @return [Array<DiskSize>]
      def align_grain
        disk_spaces.first.align_grain
      end

      # @see #all_partitions
      #
      # @return [Array<Planned::LvmVg>]
      def sorted_vgs
        # Use name to ensure stable sorting
        planned_vgs.sort_by { |vg| [vg.missing_space, vg.volume_group_name] }
      end
    end
  end
end
