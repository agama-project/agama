#!/usr/bin/env rspec
# frozen_string_literal: true

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

RSpec.shared_context "devices planner" do
  using Y2Storage::Refinements::SizeCasts

  # Just to shorten
  let(:xfs) { Y2Storage::Filesystems::Type::XFS }
  let(:vfat) { Y2Storage::Filesystems::Type::VFAT }
  let(:swap) { Y2Storage::Filesystems::Type::SWAP }
  let(:btrfs) { Y2Storage::Filesystems::Type::BTRFS }

  let(:devicegraph) { instance_double("Y2Storage::Devicegraph") }
  let(:disk) { instance_double("Y2Storage::Disk", name: "/dev/sda") }
  let(:settings) { Y2Storage::ProposalSettings.new_for_current_product }
  let(:boot_checker) { instance_double("Y2Storage::BootRequirementChecker") }

  # Some reasonable defaults
  let(:partitions) { [] }
  let(:swap_partitions) { [] }
  let(:arch) { :x86_64 }

  let(:control_file_content) { nil }

  before do
    Y2Storage::StorageManager.create_test_instance

    Yast::ProductFeatures.Import("partitioning" => control_file_content)

    allow(Y2Storage::BootRequirementsChecker).to receive(:new).and_return boot_checker
    allow(boot_checker).to receive(:needed_partitions).and_return(
      [
        Y2Storage::Planned::Partition.new("/one_boot", xfs),
        Y2Storage::Planned::Partition.new("/other_boot", vfat)
      ]
    )
    allow(devicegraph).to receive(:blk_devices).and_return([disk])
    allow(devicegraph).to receive(:partitions).and_return(partitions + swap_partitions)
    allow(disk).to receive(:swap_partitions).and_return(swap_partitions)

    allow(Yast::Arch).to receive(:architecture).and_return(arch)

    allow(Yast::SCR).to receive(:Read).with(path(".proc.meminfo"))
      .and_return("memtotal" => 8.GiB.to_i / 1.KiB.to_i)
  end
end
