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

describe Y2Storage::BootRequirementsStrategies::Raspi do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject { described_class.new(fake_devicegraph, planned, "/dev/sda", true) }

  before do
    fake_scenario("empty_disks")
  end

  let(:planned) { [planned_partition(mount_point: "/", partition_id: Y2Storage::PartitionId::LINUX)] }

  describe "#needed_partitions" do
    let(:target) { :desired }

    context "when no partition is configured at /boot/efi" do
      it "proposes only a new DOS32 first partition at /boot/efi in a MSDOS partition table" do
        partitions = subject.needed_partitions(target)
        efi = partitions.select { |p| p.mount_point == "/boot/efi" }

        expect(efi.size).to eq(1)
        expect(efi.first.partition_id).to eq(Y2Storage::PartitionId::DOS32)
        expect(efi.first.ptable_type).to eq(Y2Storage::PartitionTables::Type::MSDOS)
        expect(efi.first.max_start_offset).to_not be_nil
      end
    end

    context "when a partition without id is configured at /boot/efi" do
      let(:configured) { planned_partition(mount_point: "/boot/efi", min_size: 500.MiB) }

      before { planned << configured }

      it "does not set any id" do
        subject.needed_partitions(target)
        # A nil id means that the strategy did not decide the id: the partition creator uses the default
        # id (linux) when it creates the partition.
        expect(configured.partition_id).to be_nil
      end

      it "does not propose another partition at /boot/efi" do
        partitions = subject.needed_partitions(target)
        expect(partitions.map(&:mount_point)).to_not include("/boot/efi")
      end
    end
  end
end
