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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "storage"
require "y2storage"
require_relative "#{TEST_PATH}/support/proposal_examples"
require_relative "#{TEST_PATH}/support/proposal_context"
require_relative "#{TEST_PATH}/support/candidate_devices_context"

describe Y2Storage::GuidedProposal do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts
  let(:architecture) { :x86 }

  include_context "proposal"

  let(:scenario) { "empty_hard_disk_gpt_25GiB" }
  let(:control_file) { "legacy_settings.xml" }

  describe ".initial" do
    it "generates a proposal" do
      expect(described_class.initial(settings: settings))
        .to be_a(Y2Storage::GuidedProposal)
    end

    # Regression test for bsc#1067349
    context "with a BIOS MD RAID" do
      let(:scenario) { "rste_swraid.xml" }

      it "does not raise an exception" do
        expect { described_class.initial(settings: settings) }.to_not raise_error
      end

      it "generates a valid calculated proposal" do
        result = described_class.initial(settings: settings)
        expect(result).to be_a Y2Storage::GuidedProposal
        expect(result.devices).to be_a Y2Storage::Devicegraph
      end
    end

    # Regression test for bsc#1071798
    context "with only an unformatted ECKD DASD" do
      let(:scenario) { "unformatted-eckd-dasd" }

      it "does not raise an exception" do
        expect { described_class.initial(settings: settings) }.to_not raise_error
      end

      it "generates a failed proposal" do
        result = described_class.initial(settings: settings)
        expect(result).to be_a Y2Storage::GuidedProposal
        expect(result.failed?).to eq true
      end
    end
  end

  describe "#propose" do
    subject(:proposal) { described_class.new(settings: settings) }

    context "when the candidate devices are given" do
      include_context "candidate devices"

      let(:candidate_devices) { ["/dev/sdb", "/dev/sdc"] }

      it "only uses the given devices to make a proposal" do
        proposal.propose

        expect(candidate_devices).to include(*used_devices)
      end

      context "and the root device is given" do
        let(:root_device) { "/dev/sdc" }

        let(:sdc_usb) { true }

        it "uses the given root device to install root" do
          proposal.propose

          expect(disk_for("/").name).to eq("/dev/sdc")
        end
      end

      context "and the root device is not given" do
        let(:root_device) { nil }

        let(:sdb_usb) { true }

        let(:sdc_usb) { false }

        it "uses the first candidate device to install root" do
          proposal.propose

          expect(disk_for("/").name).to eq("/dev/sdb")
        end
      end
    end

    context "when the candidate devices are invalid" do
      include_context "candidate devices"

      let(:candidate_devices) { ["/dev/invalid_device"] }

      it "raises Y2Storage::NoDiskSpaceError exception" do
        expect { proposal.propose }.to raise_error(Y2Storage::NoDiskSpaceError)
      end
    end

    context "when the candidate devices are not given" do
      include_context "candidate devices"

      let(:candidate_devices) { nil }

      it "uses the available devices to make a proposal" do
        proposal.propose

        available_devices = ["/dev/sda", "/dev/sdb", "/dev/sdc"]

        expect(available_devices).to include(*used_devices)
      end

      context "and the root device is given" do
        let(:root_device) { "/dev/sdc" }

        let(:sdc_usb) { true }

        it "uses the given root device to install root" do
          proposal.propose

          expect(disk_for("/").name).to eq("/dev/sdc")
        end
      end

      context "and the root device is not given" do
        let(:root_device) { nil }

        context "and the candidate devices have none USB devices" do
          it "uses the first candidate device to install root" do
            proposal.propose

            expect(disk_for("/").name).to eq("/dev/sda")
          end
        end

        context "and the candidate devices have both, USB and non USB devices" do
          let(:sda_usb) { true }

          it "uses the first non USB candidate device to install root" do
            proposal.propose

            expect(disk_for("/").name).to eq("/dev/sdb")
          end
        end

        context "and there only USB candidate devices" do
          let(:sda_usb) { true }
          let(:sdb_usb) { true }
          let(:sdc_usb) { true }

          it "uses the first USB candidate device to install root" do
            proposal.propose

            expect(disk_for("/").name).to eq("/dev/sda")
          end
        end
      end
    end

    context "when forced to create a small partition" do
      let(:scenario) { "empty_hard_disk_gpt_25GiB" }
      let(:separate_home) { true }
      let(:lvm) { false }

      it "does not fail to make a proposal" do
        expect { proposal.propose }.to_not raise_error
      end

      it "creates all the needed partitions" do
        proposal.propose
        expect(proposal.devices.partitions).to contain_exactly(
          an_object_having_attributes(id: Y2Storage::PartitionId::BIOS_BOOT),
          an_object_having_attributes(filesystem_mountpoint: "/"),
          an_object_having_attributes(filesystem_mountpoint: "/home"),
          an_object_having_attributes(filesystem_mountpoint: "swap")
        )
      end
    end

    context "when installing in a multipath device" do
      let(:scenario) { "empty-dasd-and-multipath.xml" }
      let(:separate_home) { true }
      let(:lvm) { false }

      before do
        # Focus on multipath devices
        settings.candidate_devices = fake_devicegraph.multipaths.map(&:name)
      end

      it "does not fail to make a proposal" do
        expect { proposal.propose }.to_not raise_error
      end

      it "creates the needed partitions in the multipath device" do
        proposal.propose

        multipath0, multipath1 = proposal.devices.multipaths
        expect(multipath0.partitions).to contain_exactly(
          an_object_having_attributes(id: Y2Storage::PartitionId::BIOS_BOOT),
          an_object_having_attributes(filesystem_mountpoint: "/"),
          an_object_having_attributes(filesystem_mountpoint: "/home")
        )
        expect(multipath1.partitions).to contain_exactly(
          an_object_having_attributes(filesystem_mountpoint: "swap")
        )
      end

      it "creates the needed partitions with correct device names" do
        proposal.propose
        multipath0, multipath1 = proposal.devices.multipaths
        expect(multipath0.partitions.map(&:name)).to contain_exactly(
          "#{multipath0.name}-part1",
          "#{multipath0.name}-part2",
          "#{multipath0.name}-part3"
        )

        expect(multipath1.partitions.map(&:name)).to contain_exactly(
          "#{multipath1.name}-part1"
        )
      end
    end

    context "when installing in a DM RAID" do
      let(:scenario) { "empty-dm_raids_no_sda.xml" }
      let(:separate_home) { false }
      let(:lvm) { false }

      before do
        settings.candidate_devices = candidate_devices
        settings.root_device = root_device
      end

      let(:candidate_devices) { [raid_name] }

      let(:root_device) { raid_name }

      let(:raid_name) { "/dev/mapper/isw_ddgdcbibhd_test1" }

      it "does not fail to make a proposal" do
        expect { proposal.propose }.to_not raise_error
      end

      it "creates the needed partitions in the DM RAID" do
        proposal.propose

        partitions = proposal.devices.find_by_name(raid_name).partitions

        expect(partitions).to contain_exactly(
          an_object_having_attributes(id: Y2Storage::PartitionId::BIOS_BOOT),
          an_object_having_attributes(filesystem_mountpoint: "/"),
          an_object_having_attributes(filesystem_mountpoint: "swap")
        )
      end

      it "creates the needed partitions with correct device names" do
        proposal.propose

        partitions = proposal.devices.find_by_name(raid_name).partitions

        expect(partitions.map(&:name)).to contain_exactly(
          "#{raid_name}-part1",
          "#{raid_name}-part2",
          "#{raid_name}-part3"
        )
      end
    end

    context "when asked to delete all the existing partitions" do
      let(:scenario) { "windows-linux-lvm-pc" }
      let(:separate_home) { false }
      let(:lvm) { false }

      before do
        settings.windows_delete_mode = :all
        settings.linux_delete_mode = :all
        settings.other_delete_mode = :all
      end

      it "cleanups the disks before creating partitions" do
        bios_boot = Y2Storage::PartitionId::BIOS_BOOT

        proposal.propose
        expect(proposal.devices.partitions).to contain_exactly(
          an_object_having_attributes(filesystem_mountpoint: nil, id: bios_boot),
          an_object_having_attributes(filesystem_mountpoint: "/"),
          an_object_having_attributes(filesystem_mountpoint: "swap")
        )
      end
    end

    context "with pre-existing swap partitions" do
      before do
        allow(Y2Storage::Proposal::DevicesPlanner).to receive(:new).and_return dev_generator
        allow(Y2Storage::Proposal::SwapReusePlanner).to receive(:new).and_return swap_planner
        allow(dev_generator).to receive(:add_boot_devices)
        allow(swap_planner).to receive(:adjust_devices)
        settings.root_device = "/dev/sda"

        allow(Yast::Execute).to receive(:locally!).and_return uuidgen_output
      end

      let(:scenario) { "swaps" }
      let(:sda3) { fake_devicegraph.find_by_name("/dev/sda3") }
      let(:all_volumes) do
        [
          planned_vol(mount_point: "/", type: :ext4, min: 500.MiB, max: 500.MiB),
          planned_vol(mount_point: "swap", reuse_sid: sda3.sid),
          planned_vol(mount_point: "swap", type: :swap, min: 500.MiB, max: 500.MiB),
          planned_vol(mount_point: "swap", type: :swap, min: 500.MiB, max: 500.MiB),
          planned_vol(mount_point: "swap", type: :swap, min: 500.MiB, max: 500.MiB)
        ]
      end
      let(:dev_generator) do
        instance_double("Y2Storage::Proposal::DevicesPlanner", volumes_planned_devices: all_volumes)
      end
      let(:swap_planner) do
        instance_double("Y2Storage::Proposal::SwapReusePlanner")
      end
      let(:uuidgen) { "12345678-9abc-def1-2345-67890abcdef0" }
      let(:uuidgen_output) { "#{uuidgen}\n" }

      def sda(num)
        proposal.devices.find_by_name("/dev/sda#{num}")
      end

      it "reuses suitable swap partitions" do
        proposal.propose
        expect(sda(3)).to have_attributes(
          filesystem_mountpoint: "swap",
          filesystem_uuid:       "33333333-3333-3333-3333-33333333",
          filesystem_label:      "swap3",
          size:                  1.GiB - 1.MiB
        )
      end

      it "reuses UUID and label of deleted swap partitions" do
        proposal.propose
        expect(sda(2)).to have_attributes(
          filesystem_mountpoint: "swap",
          filesystem_uuid:       "11111111-1111-1111-1111-11111111",
          filesystem_label:      "swap1",
          size:                  500.MiB
        )
        expect(sda(5)).to have_attributes(
          filesystem_mountpoint: "swap",
          filesystem_uuid:       "22222222-2222-2222-2222-22222222",
          filesystem_label:      "swap2",
          size:                  500.MiB
        )
      end

      it "uses an UUID generated with uuidgen and a blank label for additional swaps" do
        proposal.propose
        expect(sda(6)).to have_attributes(
          filesystem_mountpoint: "swap", filesystem_uuid: uuidgen, filesystem_label: ""
        )
      end

      it "does not enforce any particular UUID or label for additional swaps if uuidgen failed" do
        allow(Yast::Execute).to receive(:locally!).and_raise Cheetah::ExecutionFailed.new("", "", "", "")
        proposal.propose
        expect(sda(6)).to have_attributes(
          filesystem_mountpoint: "swap", filesystem_uuid: "", filesystem_label: ""
        )
      end

      context "when it deletes partitions with id swap but not containing a swap" do
        let(:scenario) { "false-swaps" }
        let(:all_volumes) do
          [
            planned_vol(mount_point: "/", type: :ext4, min: 8.5.GiB),
            planned_vol(mount_point: "swap", type: :swap, min: 1.GiB)
          ]
        end

        # Regression test for bsc#1071515. It used to raise an exception when an
        # unformatted swap (like /dev/sda1 in our test data) had been deleted.
        it "does not fail" do
          expect { proposal.propose }.to_not raise_error
        end

        it "ignores UUIDs and labels of non-swap filesystems" do
          proposal.propose
          swap = proposal.devices.disks.first.swap_partitions.first
          expect(swap.filesystem.uuid).to_not eq "33333333-3333-3333-3333-33333333"
          expect(swap.filesystem.label).to_not eq "old_root"
        end

        it "reuses UUID and label of deleted real swap partitions" do
          proposal.propose
          swap = proposal.devices.disks.first.swap_partitions.first
          expect(swap.filesystem.uuid).to eq "44444444-4444-4444-4444-44444444"
          expect(swap.filesystem.label).to eq "old_swap"
        end
      end
    end

    context "when installing on several GPT and MBR disks" do
      let(:scenario) { "gpt_and_msdos" }
      let(:separate_home) { true }
      let(:lvm) { false }
      let(:expected) do
        file_name = "#{scenario}-#{yaml_suffix}"
        Y2Storage::Devicegraph.new_from_file(output_file_for(file_name))
      end

      before do
        settings.candidate_devices = ["/dev/sda", "/dev/sdb"]
        settings.root_device = root_device
      end

      context "if no disk is enforced for '/'" do
        let(:root_device) { nil }
        let(:yaml_suffix) { "sda_root_device" }

        include_examples "proposed layout"

        it "allocates the root device in the first candidate device" do
          proposal.propose
          expect(disk_for("/").name).to eq "/dev/sda"
        end
      end

      context "if a disk without free space is chosen for '/'" do
        let(:root_device) { "/dev/sda" }
        let(:yaml_suffix) { "sda_root_device" }

        include_examples "proposed layout"

        it "allocates in the root device the partitions that must be there" do
          proposal.propose
          expect(disk_for("/").name).to eq "/dev/sda"
        end

        it "allocates other partitions in the already available space" do
          proposal.propose
          expect(disk_for("/home").name).to eq "/dev/sdb"
          expect(disk_for("swap").name).to eq "/dev/sdb"
        end
      end

      context "if a disk with enough free space is chosen for '/'" do
        let(:root_device) { "/dev/sdb" }
        let(:yaml_suffix) { "sdb_root_device" }

        include_examples "proposed layout"

        it "allocates all the partitions there" do
          proposal.propose
          expect(disk_for("/").name).to eq "/dev/sdb"
          expect(disk_for("/home").name).to eq "/dev/sdb"
          expect(disk_for("swap").name).to eq "/dev/sdb"
        end
      end

      context "if '/' is placed in a GPT disk (legacy boot)" do
        let(:root_device) { "/dev/sdb" }

        it "creates a bios_boot partition if it's not there" do
          proposal.propose
          bios_boot = proposal.devices.partitions.select { |p| p.id.is?(:bios_boot) }

          expect(bios_boot).to_not be_empty
        end
      end

      context "if '/' is placed in a MBR disk (legacy boot)" do
        let(:root_device) { "/dev/sda" }

        it "does not create a bios_boot partition" do
          proposal.propose
          bios_boot = proposal.devices.partitions.select { |p| p.id.is?(:bios_boot) }

          expect(bios_boot).to be_empty
        end
      end
    end

    context "when there are devices with empty partition table" do
      let(:scenario) { "empty_disks" }

      before do
        settings.candidate_devices = candidate_devices
      end

      context "and some of them are candidate devices" do
        let(:candidate_devices) { ["/dev/sda", "/dev/sdb", "/dev/sdc"] }

        it "deletes the partition table on candidate devices with empty partition table" do
          proposal.propose
          sdb = proposal.devices.find_by_name("/dev/sdb")
          sdc = proposal.devices.find_by_name("/dev/sdc")

          expect(sdb.partition_table).to be_nil
          expect(sdc.partition_table).to be_nil
        end
      end

      context "and some of them are not candidate devices" do
        let(:candidate_devices) { ["/dev/sda", "/dev/sdb"] }

        it "does not delete the partition table on not candidate devices" do
          proposal.propose
          sdc = proposal.devices.find_by_name("/dev/sdc")

          expect(sdc.partition_table).to_not be_nil
        end
      end
    end

    context "when all partitions are deleted from a disk" do
      let(:scenario) { "empty_disks" }

      before do
        settings.windows_delete_mode = :all
        settings.linux_delete_mode = :all
        settings.other_delete_mode = :all

        settings.candidate_devices = ["/dev/sda"]
      end

      it "deletes the initial partition table" do
        initial_partition_table = fake_devicegraph.find_by_name("/dev/sda").partition_table
        proposal.propose
        current_partition_table = proposal.devices.find_by_name("/dev/sda").partition_table

        expect(current_partition_table.sid).to_not eq(initial_partition_table.sid)
      end
    end

    context "when installing on a device with implicit partition table" do
      let(:architecture) { :s390 }

      let(:scenario) { "several-dasds" }

      before do
        settings.candidate_devices = ["/dev/dasdb"]
      end

      context "and it is required to create more than one partition" do
        it "cannot create a valid proposal" do
          expect { proposal.propose }.to raise_error(Y2Storage::Error)
        end
      end
    end

    # Regression test for bsc#1083887
    context "when installing on a zero-size device" do
      let(:scenario) { "zero-size_disk" }

      it "cannot create a valid proposal" do
        expect { proposal.propose }.to raise_error(Y2Storage::Error)
      end
    end

    # Regression test for bsc#1088483
    context "when keeping some existing logical partitions and creating new ones" do
      let(:scenario) { "bug_1088483" }
      let(:settings_format) { :ng }
      let(:separate_home) { true }

      let(:control_file_content) do
        { "partitioning" => { "proposal" => {}, "volumes" => volumes } }
      end

      let(:volumes) do
        [
          {
            "mount_point" => "/", "fs_type" => "xfs", "weight" => 60,
            "desired_size" => "20GiB", "max_size" => "40GiB"
          },
          { "mount_point" => "/home", "fs_type" => "xfs", "weight" => 40, "desired_size" => "10GiB" },
          # This should reuse the existing logical swap
          { "mount_point" => "swap", "fs_type" => "swap", "desired_size" => "3GiB" }
        ]
      end

      before do
        settings.candidate_devices = ["/dev/sda"]
      end

      it "does not overcommit the extended partition" do
        proposal.propose
        extended = proposal.devices.find_by_name("/dev/sda4")
        logical = extended.children
        logical_sum = Y2Storage::DiskSize.sum(logical.map(&:size))
        # The overhead of the last logical partition (previously existing) is
        # smaller (only 64KiB) because we do not enforce end alignment
        # before it
        logical_overhead = (1.MiB * logical.size) - 960.KiB
        expect(logical_sum + logical_overhead).to eq extended.size
      end
    end
  end

  describe "#failed?" do
    subject(:proposal) { described_class.new }

    before do
      allow(proposal).to receive(:proposed?).and_return(proposed)
      allow(proposal).to receive(:devices).and_return(devices)
    end

    let(:devices) { nil }

    context "when it is not proposed" do
      let(:proposed) { false }

      it "returns false" do
        expect(proposal.failed?).to be false
      end
    end

    context "when it is proposed" do
      let(:proposed) { true }

      context "and it has devices" do
        let(:devices) { double("Y2Storage::Devicegraph") }

        it "returns false" do
          expect(proposal.failed?).to be false
        end
      end

      context "and it has not devices" do
        let(:devices) { nil }

        it "returns true" do
          expect(proposal.failed?).to be true
        end
      end
    end
  end
end
