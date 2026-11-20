#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::BootRequirementsStrategies::Legacy do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject { described_class.new(fake_devicegraph, planned, "/dev/sda", true) }

  before do
    fake_scenario("empty_disks")
  end

  let(:planned) do
    [planned_partition(mount_point: "/", partition_id: Y2Storage::PartitionId::LINUX)] + configured
  end

  let(:configured) do
    ["/boot", "/boot/efi", "/efi"].map { |path| planned_partition(mount_point: path, min_size: 500.MiB) }
  end

  describe "#needed_partitions" do
    it "does not set the partition id of the partitions configured at boot mount points" do
      subject.needed_partitions(:desired)

      # A nil id means that the strategy did not decide the id: the partition creator uses the default
      # id (linux) when it creates the partition.
      expect(configured.map(&:partition_id)).to all(be_nil)
    end
  end
end
