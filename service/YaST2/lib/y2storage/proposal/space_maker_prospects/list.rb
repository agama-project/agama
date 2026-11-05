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

require "y2storage/proposal/space_maker_prospects/delete_partition"
require "y2storage/proposal/space_maker_prospects/resize_partition"
require "y2storage/proposal/space_maker_prospects/wipe_disk"

module Y2Storage
  module Proposal
    module SpaceMakerProspects
      # A set of prospect actions SpaceMaker can perform to reach its goal
      #
      # @see SpaceMakerActions::List
      #
      # This class implements the logic followed by the traditional YaST GuidedProposal.
      class List
        include Yast::Logger

        # @param settings [ProposalSettings] see {#settings}
        # @param disk_analyzer [DiskAnalyzer] see {#analyzer}
        def initialize(settings, disk_analyzer)
          @settings = settings
          @analyzer = disk_analyzer

          @all_delete_partition_prospects = {
            linux:   [],
            windows: [],
            other:   []
          }

          @resize_partition_without_linux_prospects = []
          @resize_partition_with_linux_prospects = []
          @wipe_disk_prospects = []
        end

        # Adds to the set all the prospect actions for the given disk
        #
        # @see SpaceMakerActions::List#add_optional_actions
        #
        # @param disk [Disk]
        # @param volume_group [Planned::LvmVg, nil]
        def add_prospects(disk, volume_group)
          add_delete_partition_prospects(disk)
          add_resize_prospects(disk)
          add_wipe_prospects(disk, volume_group)
        end

        # Next prospect action that should be executed by SpaceMaker
        #
        # @return [SpaceMakerProspects::Base, nil] nil if there are no more
        #   available prospects
        def next_available_prospect
          # As long as there are non-Windows partitions to delete, we refuse to
          # resize Windows systems that share disk with a Linux. See
          # #next_resize_partition for the rationale.
          resize = next_resize_partition(allow_linux_in_disk: false)
          return resize if resize

          delete = next_delete_partition
          return delete if delete && !after_resizing_everything?(delete)

          wipe = next_wipe_disk
          return wipe if wipe

          # The next partition to delete would be a Windows one (or one marked
          # as last resort). In that case, reconsider resizing any Windows
          # partition (no matter whether there is a Linux in the disk)
          resize = next_resize_partition
          return resize if resize

          # If nothing else can be done, delete Windows partitions or partitions marked
          # as last resort (if any, 'delete' could also be nil)
          delete
        end

        # Marks all the prospect actions on the partitions with the given sids
        # to not be available any longer
        #
        # @param sids [Array<Integer>]
        def mark_deleted(sids)
          prospects = delete_partition_prospects + resize_partition_prospects
          prospects.select { |i| sids.include?(i.sid) }.each do |affected|
            affected.available = false
          end
        end

        # Prospects actions for deleting the unwanted partitions (i.e. when one
        # of the delete modes is set to :all) for the given disk
        #
        # @see SpaceMakerActions::List#add_mandatory_actions
        #
        # @param disk [Disk] disk to act upon
        # @return [Array<DeletePartition>]
        def unwanted_partition_prospects(disk)
          delete_prospects_for_disk(disk, for_delete_all: true)
        end

        private

        # @return [DiskAnalyzer] disk analyzer with information about the
        # initial layout of the system
        attr_reader :analyzer

        # @return [ProposalSettings]
        attr_reader :settings

        # @return [Array<WipeDisk>]
        attr_reader :wipe_disk_prospects

        # Next available prospect of type #{DeletePartition}
        #
        # @return [DeletePartition, nil] nil if there are no available prospect
        #   actions
        def next_delete_partition
          types = [:linux, :other, :windows]

          [false, true].each do |last_resort|
            types.each do |type|
              entry = delete_partition_prospects(type).find do |e|
                e.available? and e.last_resort? == last_resort
              end
              return entry if entry
            end
          end

          nil
        end

        # Next available prospect of type #{ResizePartition}
        #
        # If possible, SpaceMaker tries to avoid resizing Windows systems that
        # share its disk with Linux. That's why an optional argument is provided
        # to exclude such prospect actions.
        #
        # Rationale: users having a Windows and a Linux in the same disk have
        # likely already resized Windows once (when installing that Linux).
        # So they probably don't want to resize it again.
        #
        # @param allow_linux_in_disk [Boolean] whether to take into account
        #   target partitions that are in a disk which had also a Linux
        #   partition. See {PartitionProspect#linux_in_disk?}.
        # @return [ResizePartition, nil] nil if there are no available prospect
        #   actions
        def next_resize_partition(allow_linux_in_disk: true)
          entry = next_useful_resize(@resize_partition_without_linux_prospects)
          if entry.nil? && allow_linux_in_disk
            entry = next_useful_resize(@resize_partition_with_linux_prospects)
          end
          entry
        end

        # Next available prospect of type #{WipeDisk}
        #
        # @return [WipeDisk, nil] nil if there are no available prospect actions
        def next_wipe_disk
          wipe_disk_prospects.find(&:available?)
        end

        # Adds to the set all the prospect actions about deleting partitions of
        # the given disk (i.e. prospects of type {SpaceMakerProspects::DeletePartition})
        #
        # @param disk [Disk] disk to act upon
        def add_delete_partition_prospects(disk)
          prospects = delete_prospects_for_disk(disk)
          linux, non_linux = prospects.partition { |e| e.partition_type == :linux }
          windows, other = non_linux.partition { |e| e.partition_type == :windows }

          delete_partition_prospects(:linux).concat(sort_delete_part_prospects(linux))
          delete_partition_prospects(:windows).concat(sort_delete_part_prospects(windows))
          delete_partition_prospects(:other).concat(sort_delete_part_prospects(other))
        end

        # Adds to the set all the prospect actions about resizing partitions of
        # the given disk (i.e. prospects of type {SpaceMakerProspects::ResizePartition})
        #
        # @param disk [Disk] disk to act upon
        def add_resize_prospects(disk)
          part_names = analyzer.windows_partitions(disk.name).map(&:name)
          return if part_names.empty?

          log.info("Evaluating the following Windows partitions: #{part_names}")

          prospects = resize_prospects_for_disk(disk, part_names)
          with_linux, without_linux = prospects.partition(&:linux_in_disk?)

          @resize_partition_without_linux_prospects.concat(without_linux)
          @resize_partition_with_linux_prospects.concat(with_linux)
        end

        # If possible, adds to the set a prospect action about cleaning the disk
        # content (i.e. prospects of type {SpaceMakerProspects::WipeDisk})
        #
        # @param disk [Disk] disk to act upon
        # @param volume_groups [Array<Planned::LvmVg>] LVM VGs to be potentially reused
        def add_wipe_prospects(disk, volume_groups)
          log.info "Checking if the disk #{disk.name} has a partition table"

          return unless disk.has_children? && disk.partition_table.nil?

          log.info "Found something that is not a partition table"

          if disk.descendants.any? { |dev| vg_to_reuse?(dev, volume_groups) }
            log.info "Not cleaning up #{disk.name} because its VG must be reused"
            return
          end

          @wipe_disk_prospects << SpaceMakerProspects::WipeDisk.new(disk)
        end

        # Whether the given device corresponds to a volume group that must be reused by the
        # proposal
        #
        # @param device [Device]
        # @param volume_groups [Array<Planned::LvmVg>]
        def vg_to_reuse?(device, volume_groups)
          return false unless device.is?(:lvm_vg)

          volume_groups.any? { |vg| vg.reuse? && vg.volume_group_name == device.vg_name }
        end

        # @see #add_resize_prospects
        #
        # @return [Array<ResizePartition>]
        def resize_prospects_for_disk(disk, part_names)
          prospects = disk.partitions.select { |p| part_names.include?(p.name) }.map do |part|
            SpaceMakerProspects::ResizePartition.new(part, analyzer)
          end

          prospects.select do |action|
            allowed = action.allowed?(settings)
            log.info "SpaceMakerProspects::ResizePartition allowed? #{allowed} -> #{action}"
            allowed
          end
        end

        # @see #add_delete_partition_prospects
        # @see #unwanted_partition_prospects
        #
        # @return [Array<DeletePartition>]
        def delete_prospects_for_disk(disk, for_delete_all: false)
          partitions = disk.partitions.reject { |part| part.type.is?(:extended) }

          prospects = partitions.map do |part|
            SpaceMakerProspects::DeletePartition.new(part, analyzer, for_delete_all)
          end

          prospects.select do |action|
            allowed = action.allowed?(settings)
            log.info "SpaceMakerProspects::DeletePartition allowed? #{allowed} -> #{action}"
            allowed
          end
        end

        def next_useful_resize(prospects)
          prospects.select { |e| e.available? && !e.recoverable_size.zero? }
            .max_by(&:recoverable_size)
        end

        # Whether a given DeletePartition prospect should be considered only
        # at the end, after having tried all possible resize operations.
        #
        # @see #next_available_prospect
        #
        # @param delete_partition [DeletePartition]
        # @return [Boolean]
        def after_resizing_everything?(delete_partition)
          delete_partition.last_resort? || delete_partition.partition_type == :windows
        end

        # Returns the list of DeletePartition prospects sorted by #last_resort?
        # and #region_start
        #
        # @param list [Array<DeletePartition>]
        # @return [Array<DeletePartition>]
        def sort_delete_part_prospects(list)
          list.sort_by(&:region_start).reverse.partition(&:last_resort?).reverse.flatten
        end

        # prospects of type #{SpaceMakerProspects::DeletePartition}
        #
        # @param type [Symbol, nil] optional type to filter the result
        def delete_partition_prospects(type = nil)
          if type.nil?
            @all_delete_partition_prospects.values.flatten
          else
            @all_delete_partition_prospects[type]
          end
        end

        def resize_partition_prospects
          @resize_partition_without_linux_prospects + @resize_partition_with_linux_prospects
        end
      end
    end
  end
end
