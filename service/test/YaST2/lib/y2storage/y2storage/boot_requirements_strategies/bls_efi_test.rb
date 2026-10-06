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

require_relative "#{TEST_PATH}/support/boot_requirements_context"
require "y2storage"

describe Y2Storage::BootRequirementsStrategies::BlsEfi do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject { described_class.new(fake_devicegraph, [], "/dev/sda") }

  before do
    fake_scenario("empty_disks")
    allow(Y2Storage::BootRequirementsStrategies::Analyzer).to receive(:new).and_return(analyzer)
  end

  let(:analyzer) do
    Y2Storage::BootRequirementsStrategies::Analyzer.new(fake_devicegraph, planned, "/dev/sda")
  end

  describe ".needed_partitions" do
    let(:target) { :desired }
    let(:esp_id) { Y2Storage::PartitionId::ESP }
    let(:xbootldr_id) { Y2Storage::PartitionId::XBOOTLDR }
    let(:esp_size) { 500.MiB }
    let(:planned) { [] }

    context "when an ESP partition is already configured at /boot/efi" do
      let(:planned) do
        [planned_partition(mount_point: "/boot/efi", partition_id: esp_id)]
      end

      # The user seems to want a legacy setup
      it "does not propose any partition" do
        # Trust the user and just hope /boot/efi will be big enough
        partitions = subject.needed_partitions(target)
        expect(partitions).to be_empty
      end
    end

    context "when an ESP partition is already configured at /efi" do
      let(:planned_esp) do
        planned_partition(mount_point: "/efi", partition_id: esp_id, min_size: esp_size)
      end

      context "and no separate /boot is configured yet" do
        let(:planned) { [planned_esp] }

        context "and the ESP is big enough" do
          let(:esp_size) { 1.GiB }

          it "does not propose any additional partition" do
            partitions = subject.needed_partitions(target)
            expect(partitions).to be_empty
          end
        end

        context "and the ESP is not big enough" do
          let(:esp_size) { 100.MiB }

          it "proposes only an extra XBOOTLDR partition at /boot" do
            partitions = subject.needed_partitions(target)
            expect(partitions.size).to eq(1)
            expect(partitions.first.mount_point).to eq("/boot")
            expect(partitions.first.partition_id).to eq(Y2Storage::PartitionId::XBOOTLDR)
          end
        end
      end

      context "and also a separate /boot if configured" do
        let(:esp_size) { 100.MiB }
        let(:planned_boot) { planned_partition(mount_point: "/boot") }
        let(:planned) { [planned_esp, planned_boot] }

        # Trust the user and just hope /boot will be correct and big enough
        it "does not propose any partition" do
          partitions = subject.needed_partitions(target)
          expect(partitions).to be_empty
        end
      end
    end

    context "when an ESP partition is already configured at /boot" do
      let(:planned) do
        [planned_partition(mount_point: "/boot", partition_id: esp_id)]
      end

      # Trust the user and just hope /boot will be correct and big enough
      it "does not propose any partition" do
        partitions = subject.needed_partitions(target)
        expect(partitions).to be_empty
      end
    end

    context "when no ESP partition is configured but a XBOOTLDR is configured" do
      let(:planned) do
        [planned_partition(mount_point: xbootldr_path, partition_id: xbootldr_id)]
      end

      context "but the XBOOTLDR partition is not configured to be mounted at /boot" do
        let(:xbootldr_path) { nil }

        # Ignore that weird XBOOTLDR partition
        it "proposes an ESP partition at /boot" do
          partitions = subject.needed_partitions(target)
          expect(partitions.size).to eq(1)
          expect(partitions.first.mount_point).to eq("/boot")
          expect(partitions.first.partition_id).to eq(Y2Storage::PartitionId::ESP)
        end
      end

      context "and the XBOOTLDR partition is configured to be mounted at /boot" do
        let(:xbootldr_path) { "/boot" }

        # In fact, the size could be smaller if the separate XBOOTLDR is big enough
        it "proposes an ESP partition at /efi with default size" do
          partitions = subject.needed_partitions(target)
          expect(partitions.size).to eq(1)
          expect(partitions.first.mount_point).to eq("/efi")
          expect(partitions.first.partition_id).to eq(Y2Storage::PartitionId::ESP)
          expect(partitions.first.min_size).to eq(1.GiB)
        end
      end
    end

    context "when an ESP partition at /efi and a XBOOTLDR partition at /boot are already configured" do
      let(:planned) do
        [
          planned_partition(mount_point: "/efi", partition_id: esp_id),
          planned_partition(mount_point: "/boot", partition_id: xbootldr_id)
        ]
      end

      # Trust the user and hope he configured /boot and /efi correctly
      it "does not propose any partition" do
        partitions = subject.needed_partitions(target)
        expect(partitions).to be_empty
      end
    end
  end
end
