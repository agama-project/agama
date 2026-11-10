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

    context "when the ids of the boot partitions are not assigned" do
      let(:planned) { [planned_partition(mount_point: "/efi", min_size: 1.GiB)] }

      it "does not set the id of the configured partitions" do
        subject.needed_partitions(target)
        expect(planned.first.partition_id).to be_nil
      end

      it "does not consider the configured partition as ESP" do
        partitions = subject.needed_partitions(target)
        expect(partitions.map(&:partition_id)).to include(esp_id)
      end
    end

    context "when the partitions configured at boot mount points have no partition id" do
      subject { described_class.new(fake_devicegraph, [], "/dev/sda", true) }

      let(:planned) { configured.map { |path, size| planned_partition(mount_point: path, min_size: size) } }
      let(:configured) { {} }

      def configured_partition(path)
        planned.find { |p| p.mount_point == path }
      end

      context "and only /boot/efi is configured" do
        let(:configured) { { "/boot/efi" => 500.MiB } }

        it "sets the ESP id" do
          subject.needed_partitions(target)
          expect(configured_partition("/boot/efi").partition_id).to eq(esp_id)
        end

        it "does not propose any partition" do
          expect(subject.needed_partitions(target)).to be_empty
        end
      end

      context "and only /efi is configured" do
        let(:configured) { { "/efi" => esp_size } }

        context "and the ESP is big enough" do
          let(:esp_size) { 1.GiB }

          it "sets the ESP id" do
            subject.needed_partitions(target)
            expect(configured_partition("/efi").partition_id).to eq(esp_id)
          end

          it "does not propose any partition" do
            expect(subject.needed_partitions(target)).to be_empty
          end
        end

        context "and the ESP is not big enough" do
          let(:esp_size) { 100.MiB }

          it "sets the ESP id" do
            subject.needed_partitions(target)
            expect(configured_partition("/efi").partition_id).to eq(esp_id)
          end

          it "proposes only an extra XBOOTLDR partition at /boot" do
            partitions = subject.needed_partitions(target)
            expect(partitions.map(&:mount_point)).to eq(["/boot"])
            expect(partitions.first.partition_id).to eq(xbootldr_id)
          end
        end
      end

      context "and only /boot is configured" do
        let(:configured) { { "/boot" => boot_size } }

        context "and the partition is big enough to be the ESP" do
          let(:boot_size) { 1.GiB }

          it "sets the ESP id" do
            subject.needed_partitions(target)
            expect(configured_partition("/boot").partition_id).to eq(esp_id)
          end

          it "does not propose any partition" do
            expect(subject.needed_partitions(target)).to be_empty
          end
        end

        context "and the partition is not big enough to be the ESP" do
          let(:boot_size) { 100.MiB }

          it "sets the XBOOTLDR id" do
            subject.needed_partitions(target)
            expect(configured_partition("/boot").partition_id).to eq(xbootldr_id)
          end

          it "proposes only an ESP partition at /efi" do
            partitions = subject.needed_partitions(target)
            expect(partitions.map(&:mount_point)).to eq(["/efi"])
            expect(partitions.first.partition_id).to eq(esp_id)
          end
        end
      end

      context "and /boot/efi and /boot are configured" do
        let(:configured) { { "/boot/efi" => 500.MiB, "/boot" => 1.GiB } }

        it "sets the ESP id for /boot/efi and the XBOOTLDR id for /boot" do
          subject.needed_partitions(target)
          expect(configured_partition("/boot/efi").partition_id).to eq(esp_id)
          expect(configured_partition("/boot").partition_id).to eq(xbootldr_id)
        end

        it "does not propose any partition" do
          expect(subject.needed_partitions(target)).to be_empty
        end
      end

      context "and both /efi and /boot are configured" do
        let(:configured) { { "/efi" => 100.MiB, "/boot" => 1.GiB } }

        it "sets the ESP id for /efi and the XBOOTLDR id for /boot" do
          subject.needed_partitions(target)
          expect(configured_partition("/efi").partition_id).to eq(esp_id)
          expect(configured_partition("/boot").partition_id).to eq(xbootldr_id)
        end

        it "does not propose any partition" do
          expect(subject.needed_partitions(target)).to be_empty
        end
      end

      context "and the partitions are checked for both targets" do
        let(:configured) { { "/efi" => 100.MiB } }

        it "proposes the same partitions and keeps the ids" do
          desired = subject.needed_partitions(:desired)
          min = subject.needed_partitions(:min)

          expect(desired.map(&:mount_point)).to eq(min.map(&:mount_point))
          expect(configured_partition("/efi").partition_id).to eq(esp_id)
        end
      end
    end

    context "when the partitions configured at boot mount points have an explicit id" do
      subject { described_class.new(fake_devicegraph, [], "/dev/sda", true) }

      let(:linux_id) { Y2Storage::PartitionId::LINUX }
      let(:planned) { configured.map { |path, id| planned_partition(mount_point: path, partition_id: id) } }

      context "and /efi is configured with a non ESP id" do
        let(:configured) { { "/efi" => linux_id } }

        it "does not change the id" do
          subject.needed_partitions(target)
          expect(planned.first.partition_id).to eq(linux_id)
        end

        it "does not propose any partition" do
          expect(subject.needed_partitions(target)).to be_empty
        end
      end

      context "and /boot/efi is configured with a non ESP id" do
        let(:configured) { { "/boot/efi" => linux_id } }

        it "does not change the id" do
          subject.needed_partitions(target)
          expect(planned.first.partition_id).to eq(linux_id)
        end

        it "does not propose any partition" do
          expect(subject.needed_partitions(target)).to be_empty
        end
      end

      context "and /boot is configured with the ESP id" do
        let(:configured) { { "/boot" => esp_id } }

        it "does not change the id" do
          subject.needed_partitions(target)
          expect(planned.first.partition_id).to eq(esp_id)
        end

        it "does not propose any partition" do
          expect(subject.needed_partitions(target)).to be_empty
        end
      end

      context "and /boot is configured with a non XBOOTLDR id" do
        let(:configured) { { "/boot" => linux_id } }

        it "does not change the id" do
          subject.needed_partitions(target)
          expect(planned.first.partition_id).to eq(linux_id)
        end

        it "proposes only an ESP partition at /efi" do
          partitions = subject.needed_partitions(target)
          expect(partitions.map(&:mount_point)).to eq(["/efi"])
        end
      end
    end

    context "when the configured partitions use any combination of boot mount points" do
      subject { described_class.new(fake_devicegraph, [], "/dev/sda", true) }

      let(:esp_size) { 1.GiB }

      combinations = [
        [], ["/boot"], ["/efi"], ["/boot/efi"], ["/boot", "/efi"], ["/boot", "/boot/efi"],
        ["/efi", "/boot/efi"], ["/boot", "/efi", "/boot/efi"]
      ]

      combinations.each do |paths|
        [nil, Y2Storage::PartitionId::LINUX].each do |id|
          context "(#{paths.join(", ")}) with id #{id.inspect}" do
            let(:planned) do
              paths.map { |path| planned_partition(mount_point: path, partition_id: id) }
            end

            it "never uses a mount point more than once" do
              proposed = subject.needed_partitions(target)
              mount_points = (planned + proposed).map(&:mount_point)

              expect(mount_points).to eq(mount_points.uniq)
            end
          end
        end
      end
    end
  end
end
