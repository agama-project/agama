# Copyright (c) [2017] SUSE LLC
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
  # Y2Storage::AutoinstIssues offers an API to register and report storage
  # related AutoYaST problems.
  #
  # Basically, it works by registering found problems when creating the
  # partitioning proposal (based on AutoYaST profile) and displaying them to
  # the user. Check {Y2Storage::AutoinstIssues} in order to
  # find out more details about the kind of problems.
  #
  # About registering errors, an instance of the
  # Installation::AutoinstIssues::List (defined in yast2 package) will be used.
  module AutoinstIssues
  end
end

require "installation/autoinst_issues/list"
require "installation/autoinst_issues/issue"
require "y2storage/autoinst_issues/conflicting_attrs"
require "y2storage/autoinst_issues/could_not_calculate_boot"
require "y2storage/autoinst_issues/could_not_create_boot"
require "y2storage/autoinst_issues/exception"
require "y2storage/autoinst_issues/invalid_encryption"
require "y2storage/autoinst_issues/invalid_value"
require "y2storage/autoinst_issues/missing_btrfs_quotas"
require "y2storage/autoinst_issues/missing_reusable_device"
require "y2storage/autoinst_issues/missing_reusable_filesystem"
require "y2storage/autoinst_issues/missing_reuse_info"
require "y2storage/autoinst_issues/missing_root"
require "y2storage/autoinst_issues/missing_value"
require "y2storage/autoinst_issues/multiple_bcache_members"
require "y2storage/autoinst_issues/no_components"
require "y2storage/autoinst_issues/no_disk"
require "y2storage/autoinst_issues/no_disk_space"
require "y2storage/autoinst_issues/no_partitionable"
require "y2storage/autoinst_issues/no_proposal"
require "y2storage/autoinst_issues/shrinked_planned_devices"
require "y2storage/autoinst_issues/surplus_partitions"
require "y2storage/autoinst_issues/thin_pool_not_found"
require "y2storage/autoinst_issues/unsupported_drive_section"
