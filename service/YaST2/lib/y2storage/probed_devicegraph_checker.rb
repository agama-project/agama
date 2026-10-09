# Copyright (c) [2021] SUSE LLC
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

require "y2issues/list"
require "y2storage/bcache"
require "y2storage/bcache_cset"
require "y2storage/missing_lvm_pv_issue"
require "y2storage/unsupported_bcache_issue"
require "y2storage/inactive_root_issue"

module Y2Storage
  # Class for checking a probed devicegraph
  class ProbedDevicegraphChecker
    # Constructor
    #
    # @param devicegraph [Devicegraph] devicegraph to analyze
    def initialize(devicegraph)
      @devicegraph = devicegraph
    end

    # Issues detected in the probed devicegraph
    #
    # @return [Y2Issues::List<Issue>]
    def issues
      @issues ||= find_issues
    end

    private

    # @return [Devicegraph]
    attr_reader :devicegraph

    # Finds issues in the devicegraph
    #
    # @return [Y2Issues::List<Issue>] issues found in the devicegraph
    def find_issues
      issues = missing_pv_issues
      issues << unsupported_bcache_issue
      issues << inactive_root_issue

      Y2Issues::List.new(issues.compact)
    end

    # Issues related to LVM VGs
    #
    # @return [Array<MissingLvmPvIssue>]
    def missing_pv_issues
      wrong_vgs = devicegraph.lvm_vgs.select { |v| missing_pv?(v) }

      wrong_vgs.map { |v| MissingLvmPvIssue.new(v) }
    end

    # Returns an issue if there are unsupported Bcache devices in the devicegraph
    #
    # @return [UnsupportedBcacheIssue, nil] nil if no issue
    def unsupported_bcache_issue
      return nil unless unsupported_bcache?

      UnsupportedBcacheIssue.new
    end

    # Returns an issue if there is an inactive root filesystem in the devicegraph
    #
    # @return [InactiveRootIssue, nil] nil if no issue
    def inactive_root_issue
      filesystem = devicegraph.filesystems.find { |f| inactive_root?(f) }

      return nil unless filesystem

      InactiveRootIssue.new(filesystem)
    end

    # Checks whether the given LVM VG has missing PVs
    #
    # @param vg [Y2Storage::LvmVg]
    # @return [Boolean]
    def missing_pv?(vg)
      vg.lvm_pvs.any? { |p| p.blk_device.nil? }
    end

    # Checks whether Bcache is not supported and the devicegraph contains any Bcache device
    #
    # @return [Boolean]
    def unsupported_bcache?
      return false if Bcache.supported?

      device = Bcache.all(devicegraph).first || BcacheCset.all(devicegraph).first

      !device.nil?
    end

    # Checks whether the given filesystem is root but its mount point is inactive (not mounted)
    #
    # A root filesystem might be probed with an inactive mount point when a snapshot rollback is
    # performed but the system has not been rebooted yet. In that scenario, /etc/fstab contains an
    # entry for root, but /proc/mounts would contain none entry for the new default subvolume.
    #
    # @param filesystem [Y2Storage::Filesystems::Base]
    # @return [Boolean]
    def inactive_root?(filesystem)
      filesystem.root? && !filesystem.mount_point.active?
    end
  end
end
