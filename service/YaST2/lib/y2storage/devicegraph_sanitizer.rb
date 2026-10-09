# Copyright (c) [2018-2021] SUSE LLC
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
require "y2storage/missing_lvm_pv_issue"

module Y2Storage
  # Class to sanitize a devicegraph
  #
  # This class tries to fix the issues of the given devicegraph.
  #
  # @note Right now, it is only able to fix {MissingLvmPvIssue} issues.
  #
  # @example
  #   sanitizer = DevicegraphSanitizer.new(devicegraph)
  #   new_devicegraph = sanitizer.sanitized_devicegraph
  class DevicegraphSanitizer
    # Constructor
    #
    # @param devicegraph [Devicegraph] devicegraph to sanitize
    def initialize(devicegraph)
      @devicegraph = devicegraph
    end

    # Sanitized version of the devicegraph
    #
    # @return [Devicegraph]
    def sanitized_devicegraph
      @sanitized_devicegraph ||= sanitize
    end

    private

    # @return [Devicegraph]
    attr_reader :devicegraph

    # Generates a sanitized copy of the devicegraph
    #
    # @return [Devicegraph]
    def sanitize
      sanitized = devicegraph.dup

      issues.each { |i| fix_issue(sanitized, i) }

      sanitized
    end

    # Fixes the issue (if possible)
    #
    # @note The given devicegraph is modified.
    #
    # @param devicegraph [Devicegraph]
    # @param issue [Issue]
    def fix_issue(devicegraph, issue)
      return unless issue.is_a?(MissingLvmPvIssue)
      return unless issue.sid

      device = devicegraph.find_device(issue.sid)
      return unless device&.is?(:lvm_vg)

      devicegraph.remove_lvm_vg(device)
    end

    # Issues to fix
    #
    # @return [Y2Issues::List]
    def issues
      devicegraph.probing_issues
    end
  end
end
