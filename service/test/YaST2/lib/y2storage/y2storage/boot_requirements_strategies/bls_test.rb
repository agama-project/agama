# frozen_string_literal: true

# Copyright (c) [2025, 2026] SUSE LLC
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

describe Y2Storage::BootRequirementsStrategies::BLS do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(fake_devicegraph, [], "/dev/sda1") }

  before do
    fake_scenario("empty_disks")
    allow(Y2Storage::BootRequirementsStrategies::Analyzer).to receive(:new).and_return(analyzer)
    allow(analyzer).to receive(:free_mountpoint?).and_return(false)
  end

  let(:analyzer) do
    Y2Storage::BootRequirementsStrategies::Analyzer.new(fake_devicegraph, [], "/dev/sda1")
  end

  describe ".needed_partitions" do
    let(:target) { :desired }
    it "does not return own /boot partition" do
      ret = subject.needed_partitions(target)
      expect(ret.any? { |p| p.mount_point == "/boot" }).to eq(false)
    end

    context "when a partition is configured at /boot/efi" do
      subject { described_class.new(fake_devicegraph, planned, "/dev/sda1", assign_ids) }

      let(:assign_ids) { true }

      let(:analyzer) do
        Y2Storage::BootRequirementsStrategies::Analyzer.new(fake_devicegraph, planned, "/dev/sda1")
      end

      let(:planned) { [planned_partition(mount_point: "/boot/efi", partition_id: id)] }

      context "and it has no id" do
        let(:id) { nil }

        it "sets the ESP id" do
          subject.needed_partitions(target)
          expect(planned.first.partition_id).to eq(Y2Storage::PartitionId::ESP)
        end
      end

      context "and the ids of the boot partitions are not assigned" do
        let(:assign_ids) { false }
        let(:id) { nil }

        it "does not set the id" do
          subject.needed_partitions(target)
          expect(planned.first.partition_id).to be_nil
        end
      end

      context "and it has an explicit id" do
        let(:id) { Y2Storage::PartitionId::LINUX }

        it "does not change the id" do
          subject.needed_partitions(target)
          expect(planned.first.partition_id).to eq(Y2Storage::PartitionId::LINUX)
        end
      end
    end
  end
end
