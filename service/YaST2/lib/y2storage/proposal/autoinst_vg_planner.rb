# Copyright (c) [2018-2019] SUSE LLC
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

require "y2storage/proposal/autoinst_drive_planner"

module Y2Storage
  module Proposal
    # This class converts an AutoYaST specification into a Planned::Vg in order
    # to set up a LVM volume group.
    class AutoinstVgPlanner < AutoinstDrivePlanner
      # Returns a planned volume group according to an AutoYaST specification
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   the volume group
      # @return [Planned::LvmVg] Planned volume group
      def planned_devices(drive)
        planned_vg = Y2Storage::Planned::LvmVg.new(volume_group_name: File.basename(drive.device))
        planned_vg.extent_size = DiskSize.parse(drive.pesize, legacy_units: true) if drive.pesize

        pools, regular = drive.partitions.partition(&:pool)
        (pools + regular).each_with_object(planned_vg.lvs) do |lv_section, planned_lvs|
          planned_lv = planned_for_lv(drive, planned_vg, lv_section)
          next if planned_lv.nil? || planned_lv.lv_type == LvType::THIN

          planned_lvs << planned_lv
        end

        planned_vg.thin_pool_lvs.each { |v| add_thin_pool_lv_reuse(v, drive) }
        add_vg_reuse(planned_vg, drive)
        [planned_vg]
      end

      private

      # Returns a planned logical volume according to an AutoYaST specification
      #
      # @param drive [AutoinstProfile::DriveSection] drive section describing
      #   the volume group
      # @param planned_vg [Planned::LvmVg] Planned volume group where the logical volume will
      #   be included
      # @param section [AutoinstProfile::PartitionSection] partition section describing
      #   the logical volume
      # @return [Planned::LvmLv,nil] Planned logical volume; nil if it could not be
      #   planned
      def planned_for_lv(drive, planned_vg, section)
        # TODO: fix Planned::LvmLv.initialize
        planned_lv = Y2Storage::Planned::LvmLv.new(nil, nil)
        planned_lv.logical_volume_name = section.lv_name
        planned_lv.lv_type = lv_type_for(section)
        add_stripes(planned_lv, section)
        device_config(planned_lv, section, drive)

        return if section.used_pool && !add_to_thin_pool(planned_lv, planned_vg, section)

        add_lv_reuse(planned_lv, planned_vg, section) if section.create == false
        assign_size_to_lv(planned_vg, planned_lv, section) ? planned_lv : nil
      end

      # Set 'reusing' attributes for a logical volume
      #
      # This method modifies the first argument setting the values related to
      # reusing a logical volume (reuse and format).
      #
      # @param planned_lv [Planned::LvmLv] Planned logical volume
      # @param planned_vg [Planned::LvmVg] Volume group to search for the logical volume to reuse
      # @param section [AutoinstProfile::PartitionSection] AutoYaST specification
      def add_lv_reuse(planned_lv, planned_vg, section)
        lv_to_reuse, vg = find_lv_to_reuse(planned_vg.volume_group_name, section)
        return unless lv_to_reuse

        planned_lv.logical_volume_name ||= lv_to_reuse.lv_name
        planned_lv.filesystem_type ||= lv_to_reuse.filesystem_type
        add_device_reuse(planned_lv, lv_to_reuse, section)
        add_device_reuse(planned_lv.thin_pool, vg, section) if planned_lv.thin_pool
      end

      # Set 'reusing' attributes for a volume group
      #
      # This method modifies the first argument setting the values related to
      # reusing a volume group (reuse and format).
      #
      # @param planned_vg [Planned::LvmVg] Planned volume group
      # @param drive      [AutoinstProfile::DriveSection] drive section describing
      #   the volume group
      def add_vg_reuse(planned_vg, drive)
        planned_vg.make_space_policy = drive.keep_unknown_lv ? :keep : :remove

        return unless planned_vg.make_space_policy == :keep || planned_vg.all_lvs.any?(&:reuse?)

        vg_to_reuse = find_vg_to_reuse(planned_vg, drive)
        planned_vg.reuse_name = vg_to_reuse.vg_name if vg_to_reuse
      end

      # Set 'reusing' attributes for a thin pool logical volume
      #
      # This method modifies the argument setting the values related to reusing
      # a thin logical volume (reuse_name). A thin pool will be planned to be
      # reused if any of its logical volumes will be reused.
      #
      # @param planned_lv [Planned::LvmLv] Thin logical volume
      def add_thin_pool_lv_reuse(planned_lv, _drive)
        return unless planned_lv.thin_lvs.any?(&:reuse?)

        lv_to_reuse = devicegraph.lvm_lvs.find { |v| planned_lv.logical_volume_name == v.lv_name }
        planned_lv.reuse_name = lv_to_reuse.name
      end

      # @param vg_name     [String]      Volume group name to search for the logical volume to reuse
      # @param part_section   [AutoinstProfile::PartitionSection] LV specification from AutoYaST
      def find_lv_to_reuse(vg_name, part_section)
        parent = find_lv_parent(vg_name, part_section)
        return if parent.nil?

        device = find_lv_in_vg(parent, part_section)

        case device
        when Y2Storage::LvmLv
          [device, parent]
        when :missing_reuse_info
          issues_list.add(Y2Storage::AutoinstIssues::MissingReuseInfo, part_section)
          nil
        else
          issues_list.add(Y2Storage::AutoinstIssues::MissingReusableDevice, part_section)
          nil
        end
      end

      # Finds a logical volume within a volume group
      #
      # @param vg           [LvmVg] Volume group to search for the logical volume
      # @param part_section [AutoinstProfile::PartitionSection] LV specification from AutoYaST
      # @return [LvmLv,Symbol,nil] Logical volume to reuse; nil if it is not found or
      #   :missing_reuse_info if there is not enough information to locate it
      def find_lv_in_vg(vg, part_section)
        if part_section.lv_name
          vg.lvm_lvs.find { |v| v.lv_name == part_section.lv_name }
        elsif part_section.uuid
          vg.lvm_lvs.find { |v| v.filesystem_uuid == part_section.uuid }
        elsif part_section.label
          vg.lvm_lvs.find { |v| v.filesystem_label == part_section.label }
        else
          :missing_reuse_info
        end
      end

      # @param vg_name      [String]      Volume group name to search for the logical volume
      # @param part_section [AutoinstProfile::PartitionSection] LV specification from AutoYaST
      def find_lv_parent(vg_name, part_section)
        vg = devicegraph.lvm_vgs.find { |v| v.vg_name == vg_name }
        if vg.nil?
          issues_list.add(Y2Storage::AutoinstIssues::MissingReusableDevice, part_section)
          return
        end

        part_section.used_pool ? find_thin_pool_lv(vg, part_section) : vg
      end

      # @param planned_vg  [Planned::LvmVg] Planned volume group
      # @param drive       [AutoinstProfile::DriveSection] drive section describing
      def find_vg_to_reuse(planned_vg, drive)
        return nil unless planned_vg.volume_group_name

        device = devicegraph.lvm_vgs.find { |v| v.vg_name == planned_vg.volume_group_name }
        issues_list.add(Y2Storage::AutoinstIssues::MissingReusableDevice, drive) unless device
        device
      end

      # @param vg [LvmVg]   Logical volume group
      # @param part_section [AutoinstProfile::PartitionSection] LV specification from AutoYaST
      def find_thin_pool_lv(vg, part_section)
        lv = vg.lvm_lvs.find { |v| v.lv_name == part_section.used_pool }
        return lv if lv

        issues_list.add(Y2Storage::AutoinstIssues::ThinPoolNotFound, part_section)
        nil
      end

      # Assign LV size according to AutoYaST section
      #
      # @param planned_vg [Planned::LvmVg] Volume group
      # @param planned_lv [Planned::LvmLv] Logical volume
      # @param lv_section [AutoinstProfile::PartitionSection] AutoYaST section
      # @return [Boolean] true if the size was parsed and asssigned; false it was not valid
      def assign_size_to_lv(planned_vg, planned_lv, lv_section)
        size_info = parse_size(lv_section, planned_vg.extent_size, DiskSize.unlimited)

        if size_info.nil?
          issues_list.add(Y2Storage::AutoinstIssues::InvalidValue, lv_section, :size)
          return false
        end

        if size_info.percentage
          planned_lv.percent_size = size_info.percentage
        else
          planned_lv.min_size = size_info.min
          planned_lv.max_size = size_info.max
        end
        planned_lv.weight = 1 if size_info.unlimited?

        true
      end

      # Return the logical volume type for a given section
      #
      # @param section [AutoinstProfile::PartitionSection] AutoYaST specification
      # @return [LvType] Logical volume type
      def lv_type_for(section)
        if section.pool
          LvType::THIN_POOL
        elsif section.used_pool
          LvType::THIN
        else
          LvType::NORMAL
        end
      end

      # Add a logical volume to a thin pool
      #
      # @param planned_lv [Planned::LvmLv] Planned logical volume
      # @param planned_vg [Planned::LvmVg] Planned volume group
      # @param section [AutoinstProfile::PartitionSection] AutoYaST specification
      # @return [Boolean] True if it was successfully added; false otherwise.
      def add_to_thin_pool(planned_lv, planned_vg, section)
        thin_pool = planned_vg.thin_pool_lvs.find { |v| v.logical_volume_name == section.used_pool }
        if thin_pool.nil?
          issues_list.add(Y2Storage::AutoinstIssues::ThinPoolNotFound, section)
          return false
        end
        thin_pool.add_thin_lv(planned_lv)
      end

      # Sets stripes related attributes
      #
      # @param planned_lv [Planned::LvmLv] Planned logical volume
      # @param section    [AutoinstProfile::PartitionSection] partition section describing
      #   the logical volume
      def add_stripes(planned_lv, section)
        planned_lv.stripe_size = DiskSize.KiB(section.stripe_size.to_i) if section.stripe_size
        planned_lv.stripes = section.stripes
      end
    end
  end
end
