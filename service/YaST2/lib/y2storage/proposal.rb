# Copyright (c) [2016] SUSE LLC
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
  # Namespace for all the utility classes used internally by the different kind
  # of proposals.
  module Proposal
  end
end

require "y2storage/proposal/base"
require "y2storage/proposal/devicegraph_generator"
require "y2storage/proposal/lvm_helper"
require "y2storage/proposal/autoinst_devices_creator"
require "y2storage/proposal/autoinst_devices_planner"
require "y2storage/proposal/autoinst_space_maker"
require "y2storage/proposal/autoinst_drives_map"
require "y2storage/proposal/partition_creator"
require "y2storage/proposal/autoinst_bcache_creator"
require "y2storage/proposal/lvm_creator"
require "y2storage/proposal/autoinst_md_creator"
require "y2storage/proposal/partition_killer"
require "y2storage/proposal/partitions_distribution_calculator"
require "y2storage/proposal/phys_vol_calculator"
require "y2storage/proposal/devices_planner"
require "y2storage/proposal/swap_reuse_planner"
require "y2storage/proposal/space_maker"
require "y2storage/proposal/partition_table_creator"
require "y2storage/proposal/settings_generator"
require "y2storage/proposal/planned_devices_handler"
