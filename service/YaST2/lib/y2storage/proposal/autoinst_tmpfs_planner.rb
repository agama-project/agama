# Copyright (c) [2020] SUSE LLC
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
require "y2storage/planned/tmpfs"
require "y2storage/autoinst_issues"

module Y2Storage
  module Proposal
    # This class converts an AutoYaST specification into a Planned::Tmpfs
    class AutoinstTmpfsPlanner < AutoinstDrivePlanner
      # Returns a planned Tmpfs according to an AutoYaST specification
      #
      # @param drive_section [AutoinstProfile::DriveSection] drive section describing the Tmpfs
      # @return [Array<Planned::Tmpfs>] Array containing the planned Tmpfs
      def planned_devices(drive_section)
        drive_section.partitions.map { |p| planned_tmpfs(p) }.compact
      end

      private

      # Generates a planned Tmpfs from a drive section
      #
      # @param partition_section [AutoinstProfile::PartitionSection] partition section
      #   describing the tmpfs filesystem
      # @return [Planned::Tmpfs,nil] A planned tmpfs or nil if it some error ocurred
      def planned_tmpfs(partition_section)
        if partition_section.mount.nil? || partition_section.mount.empty?
          issues_list.add(Y2Storage::AutoinstIssues::MissingValue, partition_section, :mount)
          return
        end

        Planned::Tmpfs.new(partition_section.mount, partition_section.fstab_options)
      end
    end
  end
end
