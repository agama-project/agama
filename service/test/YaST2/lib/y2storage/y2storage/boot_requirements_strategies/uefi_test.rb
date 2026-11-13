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

describe Y2Storage::BootRequirementsStrategies::UEFI do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject { described_class.new(fake_devicegraph, planned, "/dev/sda", assign_ids) }

  let(:assign_ids) { true }

  before do
    fake_scenario("empty_disks")
  end

  let(:esp_id) { Y2Storage::PartitionId::ESP }
  let(:linux_id) { Y2Storage::PartitionId::LINUX }
  let(:planned) { [planned_root] + configured }
  let(:planned_root) { planned_partition(mount_point: "/", partition_id: linux_id) }
  let(:configured) { [] }

  describe "#needed_partitions" do
    let(:target) { :desired }

    context "when no partition is configured for any boot mount point" do
      it "proposes only an ESP partition at /boot/efi" do
        partitions = subject.needed_partitions(target)

        efi = partitions.select { |p| p.mount_point == "/boot/efi" }
        expect(efi.size).to eq(1)
        expect(efi.first.partition_id).to eq(esp_id)
      end
    end

    context "when the ids of the boot partitions are not assigned" do
      let(:assign_ids) { false }
      let(:configured) { [planned_partition(mount_point: "/boot/efi", min_size: 500.MiB)] }

      it "does not set the id of the configured partitions" do
        subject.needed_partitions(target)
        expect(configured.first.partition_id).to be_nil
      end
    end

    context "when a partition without id is configured at /boot/efi" do
      let(:configured) { [planned_partition(mount_point: "/boot/efi", min_size: 500.MiB)] }

      it "sets the ESP id" do
        subject.needed_partitions(target)
        expect(configured.first.partition_id).to eq(esp_id)
      end

      it "does not propose another partition at /boot/efi" do
        partitions = subject.needed_partitions(target)
        expect(partitions.map(&:mount_point)).to_not include("/boot/efi")
      end

      it "sets the same id if the partitions are calculated again" do
        subject.needed_partitions(:desired)
        subject.needed_partitions(:min)
        expect(configured.first.partition_id).to eq(esp_id)
      end
    end

    context "when a partition with an explicit id is configured at /boot/efi" do
      let(:configured) do
        [planned_partition(mount_point: "/boot/efi", min_size: 500.MiB, partition_id: linux_id)]
      end

      it "does not change the id" do
        subject.needed_partitions(target)
        expect(configured.first.partition_id).to eq(linux_id)
      end

      it "does not propose another partition at /boot/efi" do
        partitions = subject.needed_partitions(target)
        expect(partitions.map(&:mount_point)).to_not include("/boot/efi")
      end
    end

    context "when a partition without id is configured at /boot" do
      let(:configured) { [planned_partition(mount_point: "/boot", min_size: 1.GiB)] }

      it "does not set any id" do
        subject.needed_partitions(target)
        expect(configured.first.partition_id).to be_nil
      end

      it "proposes an ESP partition at /boot/efi" do
        partitions = subject.needed_partitions(target)
        expect(partitions.map(&:mount_point)).to include("/boot/efi")
      end
    end

    context "when a partition without id is configured at /efi" do
      let(:configured) { [planned_partition(mount_point: "/efi", min_size: 500.MiB)] }

      it "does not set any id" do
        subject.needed_partitions(target)
        expect(configured.first.partition_id).to be_nil
      end
    end
  end
end
