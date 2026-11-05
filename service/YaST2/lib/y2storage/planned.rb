# Copyright (c) [2017-2019] SUSE LLC
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

require "y2storage/planned/disk"
require "y2storage/planned/partition"
require "y2storage/planned/stray_blk_device"
require "y2storage/planned/lvm_lv"
require "y2storage/planned/lvm_vg"
require "y2storage/planned/md"
require "y2storage/planned/bcache"
require "y2storage/planned/nfs"
require "y2storage/planned/tmpfs"
require "y2storage/planned/assigned_space"
require "y2storage/planned/partitions_distribution"
require "y2storage/planned/devices_collection"
