# Copyright (c) [2015] SUSE LLC
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

require "yast"
require "storage"
require "y2storage/disk_size"
require "y2storage/planned"
require "y2storage/proposal/phys_vol_calculator"
require "y2storage/proposal/resize_phys_vol_calculator"

module Y2Storage
  module Proposal
    # Class to find the optimal distribution of planned partitions into the
    # existing disk spaces
    class PartitionsDistributionCalculator
      include Yast::Logger

      # Constructor
      #
      # @param partitions [Array<Planned::Partition>] see {#planned_partitions}
      # @param planned_vgs [Array<Planned::LvmVg>] see {#planned_vgs}
      def initialize(partitions = [], planned_vgs = [], default_disks = nil)
        @planned_partitions = partitions
        # Always process first volume groups that are more limited in their usage of different
        # disks. Use the name as second sort criteria for stable sorting between executions.
        @planned_vgs = planned_vgs.sort_by do |vg|
          [vg.pvs_candidate_devices.size, vg.volume_group_name]
        end
        @default_disks = default_disks
      end

      # Best possible distribution, nil if the planned partitions don't fit
      #
      # If it's necessary to provide LVM space (according to the planned VG),
      # the result will include one or several extra planned partitions to host
      # the LVM physical volumes that need to be created in order to reach
      # that size (within the max limits defined for the planned VG).
      #
      # @param spaces [Array<FreeDiskSpace>] spaces that can be used to allocate partitions
      # @return [Planned::PartitionsDistribution, nil]
      def best_distribution(spaces)
        log.info "Calculating best space distribution for #{planned_partitions.inspect}"
        # First, make sure the whole attempt makes sense
        return nil if impossible?(planned_partitions, spaces)

        begin
          dist_hashes = distribute_partitions(planned_partitions, spaces)
        rescue NoDiskSpaceError
          return nil
        end
        candidates = distributions_from_hashes(dist_hashes)

        add_physical_volumes(candidates, spaces)
        candidates.compact!

        best_candidate(candidates)
      end

      # Space that should be freed when resizing an existing partition in
      # order to have a good chance of creating a valid PartitionsDistribution
      # (by means of #best_distribution).
      #
      # Used when resizing windows in order to know how much space to remove
      # from the partition.
      #
      # @param partition [Partition] partition to resize
      # @param free_spaces [Array<FreeDiskSpace>] all free spaces in the system
      # @return [DiskSize]
      def resizing_size(partition, free_spaces)
        # This is far more complex than "needed_space - current_space" because
        # we really have to find a distribution that is valid.
        #
        # The following code tries to find the minimal valid distribution
        # that would succeed, taking into account that resizing will introduce a
        # new space or make one of the existing spaces grow.

        disk = partition.partitionable.name
        disk_spaces = free_spaces.select { |s| s.disk_name == disk }
        disk_partitions = planned_partitions.select { |p| compatible_disk?(p, disk) }

        disk_spaces = add_or_mark_growing_space(disk_spaces, partition)

        size =
          if incomplete_planned_vgs.empty?
            calculate_resizing_size(partition, disk_partitions, disk_spaces)
          else
            calculate_resizing_size_lvm(partition, disk_partitions, disk_spaces)
          end

        # In situations where resizing the partition cannot provide a valid solution, reclaim as
        # much space as possible by returning the partition size as fallback value.
        size || partition.size
      end

      # When calculating an LVM proposal, this represents the projected volume groups for
      # which is necessary to automatically allocate physical volumes (based on their respective
      # values for {Planned::LvmVg#pvs_candidate_devices}.
      #
      # Empty if LVM is not involved (partition-based proposal)
      #
      # @return [Array<Planned::LvmVg>]
      attr_reader :planned_vgs

      # @return [Array<Planned::Partition>] planned partitions to find space for
      attr_reader :planned_partitions

      attr_reader :default_disks

      protected

      # Checks whether there is any chance of producing a valid
      # PartitionsDistribution to accomodate the planned partitions and the
      # missing LVM part in the free spaces
      #
      # This check could be improved to detect more situations that make it impossible
      # to get a distribution, but the goal is to keep it relatively simple and fast.
      def impossible?(planned_partitions, free_spaces)
        # Let's assume the best possible case - if we need to create PVs it will be only one per VG
        planned_partitions += single_pv_partitions

        # First, do the simplest calculation - checking total sizes
        needed = DiskSize.sum(planned_partitions.map(&:min))
        log.info "#impossible? - needed: #{needed}"
        return true if needed > available_space(free_spaces)

        impossible_partitions?(planned_partitions, free_spaces)
      end

      # Check for partitions that need to be in a specific disk.
      # For simplicity, partitions with no pre-assigned disk are left out
      def impossible_partitions?(planned_partitions, free_spaces)
        planned_partitions.select(&:disk).group_by(&:disk).each do |disk, parts|
          needed = DiskSize.sum(parts.map(&:min))
          available = available_space(free_spaces.select { |s| s.disk_name == disk })
          log.info "#impossible? (#{disk}) - needed: #{needed} - avail: #{available}"
          return true if needed > available
        end

        false
      end

      # Planned volume groups that need some extra physical volume
      #
      # @return [Array<Planned::LvmVg]
      def incomplete_planned_vgs
        planned_vgs.select { |vg| vg.missing_space > DiskSize.zero }
      end

      # Simplest possible collection of missing physical volumes (only one per incomplete volume
      # group)
      #
      # @return [Array<Planned::Partition>]
      def single_pv_partitions
        incomplete_planned_vgs.map(&:single_pv_partition)
      end

      # Returns the sum of available spaces
      #
      # @param free_spaces [Array<FreeDiskSpace>] List of free disk spaces
      # @return [DiskSize] Available disk space
      def available_space(free_spaces)
        DiskSize.sum(free_spaces.map(&:disk_size))
      end

      # For each planned partition, it returns a list of the disk spaces
      # that could potentially host it.
      #
      # Of course, each disk space can appear on several lists.
      #
      # @param planned_partitions [Array<Planned::Partition>]
      # @param free_spaces [Array<FreeDiskSpace>]
      # @return [Hash{Planned::Partition => Array<FreeDiskSpace>}]
      def candidate_disk_spaces(planned_partitions, free_spaces)
        planned_partitions.each_with_object({}) do |partition, hash|
          spaces = partition_candidate_spaces(partition, free_spaces)
          if spaces.empty?
            log.error "No suitable free space for #{partition}"
            raise NoDiskSpaceError, "No suitable free space for the planned partition"
          end
          hash[partition] = spaces
        end
      end

      # @see #resizing_size
      #
      # @return [DiskSize, nil] nil if resizing the partition does not seem to be
      #   enough to make the partitions fit
      def calculate_resizing_size(partition, partitions, spaces)
        begin
          dist_hashes = distribute_partitions(partitions, spaces)
        rescue NoDiskSpaceError
          # No valid distribution can be found for the projected partitions
          return nil
        end

        missing = missing_size_in_growing_space(dist_hashes, partition.align_grain)

        # Fail if resizing the partition does not provide any valid distribution
        return nil unless missing

        missing + partition.end_overhead
      end

      # Equivalent to {#calculate_resizing_size} but adding some planned partitions to act as
      # physical volumes for the planned LVM volume groups
      #
      # @return [DiskSize, nil]
      def calculate_resizing_size_lvm(partition, partitions, spaces)
        # There are many heuristics we could use to try to add the physical volumes, but so far we
        # only try two and use the best result. Thus, this method uses a quite explicit algorithm,
        # instead of a generic loop iterating over different heuristics with cryptic names.

        # Robust heuristic - assume there will be only one big PV per volume group.
        # Quite pessimistic, it can easily produce results bigger than strictly needed.
        sizes = [calculate_resizing_size(partition, partitions + single_pv_partitions, spaces)]

        if spaces.size > 1
          # A bit more complex heuristic that tries to be less pessimistic by making use of the
          # spaces that are not going to be consumed by other partitions. It makes several
          # assumptions that can lead to impossible distributions (specially on MS-DOS partition
          # tables).
          calc = ResizePhysVolCalculator.new(spaces, incomplete_planned_vgs, partitions)
          sizes << calculate_resizing_size(partition, calc.all_partitions, spaces) if calc.useful?
        end

        sizes.compact!
        sizes.empty? ? nil : sizes.min
      end

      # @see #best_distribution
      #
      # @param candidates [Array<Planned::PartitionsDistribution>]
      # @param spaces [Array<FreeDiskSpace>]
      def add_physical_volumes(candidates, spaces)
        candidates.map! do |dist|
          incomplete_planned_vgs.inject(dist) do |res, planned_vg|
            pv_spaces = spaces_for_vg(spaces, planned_vg)
            pv_calculator = PhysVolCalculator.new(pv_spaces, planned_vg)
            pv_calculator.add_physical_volumes(res)
          end
        end
      end

      # Subset of spaces that are located at devices that are acceptable for the given
      # planed volume group
      #
      # @param all_spaces [Array<FreeDiskSpace>] full set of spaces
      # @param volume_group [Planned::VolumeGroup]
      # @return [Array<FreeDiskSpace>] subset of spaces that could contain a
      #   physical volume
      def spaces_for_vg(all_spaces, volume_group)
        disk_name = volume_group.forced_disk_name
        return all_spaces.select { |i| i.disk_name == disk_name } if disk_name

        disk_names = volume_group.pvs_candidate_devices
        disk_names = default_disks if disk_names.empty? && default_disks

        all_spaces.select { |s| disk_names.include?(s.disk_name) }
      end

      # All possible combinations of spaces and planned partitions.
      #
      # The result is an array in which each entry represents a potential
      # distribution of partitions into spaces taking into account the
      # restrictions set by disk_spaces_by_partition.
      #
      # @param disk_spaces_by_partition [Hash{Planned::Partition => Array<FreeDiskSpace>}]
      #     which spaces are acceptable for each planned partition
      # @return [Array<Hash{FreeDiskSpace => Array<Planned::Partition>}>]
      def distribution_hashes(disk_spaces_by_partition)
        return [{}] if disk_spaces_by_partition.empty?

        hash_product(disk_spaces_by_partition).map do |combination|
          # combination looks like this
          # {partition1 => space1, partition2 => space1, partition3 => space2 ...}
          inverse_hash(combination)
        end
      end

      # @param partition [Planned::Partition]
      # @param space [FreeDiskSpace]
      #
      # @return [Boolean]
      def suitable_disk_space?(space, partition)
        return false unless compatible_disk?(partition, space.disk_name)
        return false unless compatible_ptable?(partition, space)
        return false unless partition_fits_space?(partition, space)

        max_offset = partition.max_start_offset
        return false if max_offset && space.start_offset > max_offset

        true
      end

      # @see #candidate_disk_spaces
      #
      # @param partition [Planned::Partition]
      # @param candidate_spaces [Array<FreeDiskSpace>]
      # @return [Array<FreeDiskSpace>]
      def partition_candidate_spaces(partition, candidate_spaces)
        candidate_spaces.select { |space| suitable_disk_space?(space, partition) }
      end

      # @param partition [Planned::Partition]
      # @param disk_name [String]
      #
      # @return [Boolean]
      def compatible_disk?(partition, disk_name)
        return partition.disk == disk_name if partition.disk

        pv_candidates = planned_vg_for(partition)&.pvs_candidate_devices
        return pv_candidates.include?(disk_name) if pv_candidates&.any?

        return true unless default_disks

        default_disks.include?(disk_name)
      end

      # Planned volume group associated to the given partition, if any
      #
      # @param planned_partition [Planned::Partition]
      # @return [Planned::LvmVg, nil] nil if the partition is not meant as an LVM PV
      def planned_vg_for(planned_partition)
        planned_vgs.find { |vg| vg.volume_group_name == planned_partition.lvm_volume_group_name }
      end

      # @param partition [Planned::Partition]
      # @param space [FreeDiskSpace]
      #
      # @return [Boolean]
      def partition_fits_space?(partition, space)
        space.growing? ? true : space.disk_size >= partition.min_size
      end

      # @param partition [Planned::Partition]
      # @param space [FreeDiskSpace]
      #
      # @return [Boolean]
      def compatible_ptable?(partition, space)
        return true if partition.ptable_type.nil?
        return true if space.disk.partition_table.nil?

        partition.ptable_type == space.disk.partition_table.type
      end

      # All possible combinations of spaces and planned partitions.
      #
      # The result is an array in which each entry represents a potential
      # distribution of partitions into spaces taking into account the
      # restrictions impossed by the planned partitions.
      #
      # All disk spaces are present in the result, including those that cannot
      # host any planned partition.
      #
      # @param partitions [Array<Planned::Partitions>]
      # @param spaces [Array<FreeDiskSpace>]
      # @return [Array<Hash{FreeDiskSpace => Array<Planned::Partition>}>]
      def distribute_partitions(partitions, spaces)
        log.info "Selecting the candidate spaces for each planned partition"
        disk_spaces_by_part = candidate_disk_spaces(partitions, spaces)

        log.info "Calculate all the possible distributions of planned partitions into spaces"
        dist_hashes = distribution_hashes(disk_spaces_by_part)
        add_unused_spaces(dist_hashes, spaces)
        dist_hashes
      end

      # Cartesian product (that is, all the possible combinations) of hash
      # whose values are arrays.
      #
      # @example
      #   hash = {
      #     vol1: [:space1, :space2],
      #     vol2: [:space1],
      #     vol3: [:space2, :space3]
      #   }
      #   hash_product(hash) #=>
      #   # [
      #   #  {vol1: :space1, vol2: :space1, vol3: :space2},
      #   #  {vol1: :space1, vol2: :space1, vol3: :space3},
      #   #  {vol1: :space2, vol2: :space1, vol3: :space2},
      #   #  {vol1: :space2, vol2: :space1, vol3: :space3}
      #   # ]
      #
      # @param hash [Hash{Object => Array}]
      # @return [Array<Hash>]
      def hash_product(hash)
        keys = hash.keys
        # Ensure same order
        arrays = keys.map { |key| hash[key] }
        product = arrays[0].product(*arrays[1..-1])
        product.map { |p| keys.zip(p).to_h }
      end

      # Inverts keys and values of a hash
      #
      # @example
      #   hash = {vol1: :space1, vol2: :space1, vol3: :space2}
      #   inverse_hash(hash) #=> {space1: [:vol1, :vol2], space2: [:vol3]}
      #
      # @return [Hash] original values as keys and arrays of original
      #     keys as values
      def inverse_hash(hash)
        hash.each_with_object({}) do |(key, value), out|
          out[value] ||= []
          out[value] << key
        end
      end

      # Transforms a set of hashes containing tentative partition distributions
      # into proper {Planned::PartitionsDistribution} objects.
      #
      # Hashes describing invalid distributions are discarded, so the resulting
      # array can have less elements than the original list.
      #
      # @param dist_hashes [Array<Hash{FreeDiskSpace => Array<Planned::Partition>}>]
      # @return [Array<Planned::PartitionsDistribution>]
      def distributions_from_hashes(dist_hashes)
        dist_hashes.each_with_object([]) do |distribution_hash, array|
          begin
            dist = Planned::PartitionsDistribution.new(distribution_hash)
          rescue Error
            next
          end
          array << dist
        end
      end

      # Best partitions distribution
      #
      # @param candidates [Array<Planned::PartitionsDistribution>]
      # @return [Planned::PartitionsDistribution]
      def best_candidate(candidates)
        log.info "Comparing #{candidates.size} distributions"
        result = candidates.min { |a, b| a.better_than(b) }
        log.info "best_for result: #{result}"
        result
      end

      # Add unused spaces to a distributions hash
      #
      # @param dist_hashes [Array<Hash{FreeDiskSpace => Array<Planned::Partition>}>]
      #   Distribution hashes
      # @param spaces      [Array<FreeDiskSpace>] Free spaces
      # @return [Array<Hash{FreeDiskSpace => Array<Planned::Partition>}>]
      #   Distribution hashes considering all free disk spaces.
      def add_unused_spaces(dist_hashes, spaces)
        spaces_hash = spaces.product([[]]).to_h
        dist_hashes.map! { |d| spaces_hash.merge(d) }
      end

      # Based on the partition to be resized, sets the FreeDiskSpace#growing? attribute
      # in one of the existing spaces, or adds a new FreeDiskSpace object to the
      # collection if a new space will be created.
      #
      # @see resizing_size
      # @see FreeDiskSpace#growing?
      #
      # @param free_spaces [Array<FreeDiskSpace>] initial list of free spaces in
      #   the system (#growing? returns false for all of them)
      # @param partition [Partition] partition to be resized
      # @return [Array<FreeDiskSpace>] list of free spaces containing a growing one
      #   (added to the list or replacing the original space affected by the resizing)
      def add_or_mark_growing_space(free_spaces, partition)
        result = free_spaces.map do |space|
          if space_right_after_partition?(space, partition)
            new_space = space.dup
            new_space.growing = true
            new_space
          else
            space
          end
        end

        if result.none?(&:growing?)
          # Use partition.region as starting point. After all, the exact start
          # and end positions are not that relevant for our purposes.
          new_space = FreeDiskSpace.new(partition.partitionable, partition.region)
          new_space.growing = true
          new_space.exists = false
          result << new_space
        end

        result
      end

      # Whether the given free space is located right at the end of the given
      # partition, implying the space will grow if the partition is shrunk.
      #
      # Note that if the space is at the beginning of an extended partition this
      # always returns false, that space can only be reclaimed by deleting
      # partitions, not via resizing.
      #
      # @param free_space [FreeDiskSpace]
      # @param partition [Partition] partition to be resized
      # @return [Boolean]
      def space_right_after_partition?(free_space, partition)
        free_space.partitionable == partition.partitionable &&
          free_space.region.start == partition.region.end + 1
      end

      # Size that is missing in the space marked as "growing" in order to
      # guarantee that at least one valid distribution is possible.
      #
      # @param dist_hashes [Array<Hash{FreeDiskSpace => Array<Planned::Partition>}>]
      #   Distribution hashes
      # @param align_grain [DiskSize] align grain of the device that hosts the
      #   partition been resized
      #
      # @return [Disksize, nil] nil if it's not possible to guarantee a valid
      #   distribution, no matter how much the growing space is enlarged
      #
      def missing_size_in_growing_space(dist_hashes, align_grain)
        # Group all the distributions based on the partitions assigned
        # to the growing space
        alternatives_for_growing = group_dist_hashes_by_growing_space(dist_hashes)

        # We don't want to know all the valid distributions, we just want to find
        # one valid distribution that minimizes the space to be allocated in
        # growing space.
        #
        # So, first of all, sort all the candidate distribution hashes so we
        # explore first the ones that demands less space in the growing space.
        sorted_keys = alternatives_for_growing.keys.sort do |parts_in_a, parts_in_b|
          compare_planned_parts_sets_size(parts_in_a, parts_in_b, align_grain)
        end

        sorted_keys.each do |parts|
          distros = distributions_from_hashes(alternatives_for_growing[parts])
          next if distros.empty?

          # At least one distribution is valid
          assigned_spaces = distros.map { |i| i.spaces.find { |a| a.disk_space.growing? } }

          # There are valid distributions that don't need to use the growing space
          return DiskSize.zero if assigned_spaces.include?(nil)

          missing = assigned_spaces.map(&:total_missing_size).min
          return missing.ceil(align_grain)
        end

        # No valid distributions were found, no matter which planned partitions
        # we assign to the growing space
        nil
      end

      # Compares two sets of planned partitions in order to sort them by total
      # min size, ensuring stable result if both sets have the same total min
      # size
      #
      # @param parts_a [Array<Planned::Partition>]
      # @param parts_b [Array<Planned::Partition>]
      # @param align_grain [DiskSize]
      # @return [Integer] -1 if parts_a is smaller than parts_b, 1 in other case
      def compare_planned_parts_sets_size(parts_a, parts_b, align_grain)
        size_in_a = DiskSize.sum(parts_a.map(&:min), rounding: align_grain)
        size_in_b = DiskSize.sum(parts_b.map(&:min), rounding: align_grain)
        result_by_size = size_in_a <=> size_in_b
        return result_by_size unless result_by_size.zero?

        # Fallback to guarantee stable sorting
        ids_in_a = parts_a.map(&:planned_id).join
        ids_in_b = parts_b.map(&:planned_id).join
        ids_in_a <=> ids_in_b
      end

      # @see missing_size_in_growing_space
      def group_dist_hashes_by_growing_space(dist_hashes)
        result = {}
        dist_hashes.each do |dist|
          key = dist.find { |k, _v| k.growing? }.last
          result[key] ||= []
          result[key] << dist
        end
        result
      end
    end
  end
end
