# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require_relative "../agama/storage/storage_helpers"
require "agama/config"
require "agama/storage/config"
require "agama/storage/config_conversions/from_json"
require "y2storage"
require "y2storage/agama_proposal"

using Y2Storage::Refinements::SizeCasts

# @param config [Agama::Storage::Configs::Drive, Agama::Storage::Configs::Partition]
# @param name [String, nil] e.g., "/dev/vda"
# @param filesystem [String, nil] e.g., "xfs"
def block_device_config(config, name: nil, filesystem: nil)
  if name
    config.search = Agama::Storage::Configs::Search.new.tap do |search_config|
      search_config.name = name
    end
  end

  if filesystem
    config.filesystem = Agama::Storage::Configs::Filesystem.new.tap do |fs_config|
      fs_config.type = Agama::Storage::Configs::FilesystemType.new.tap do |type_config|
        type_config.fs_type = Y2Storage::Filesystems::Type.find(filesystem)
      end
    end
  end

  config
end

# @param name [String, nil] e.g., "/dev/vda"
# @param filesystem [String, nil] e.g., "xfs"
def drive_config(name: nil, filesystem: nil)
  config = Agama::Storage::Configs::Drive.new
  block_device_config(config, name: name, filesystem: filesystem)
end

# @param name [String, nil] e.g., "/dev/vda"
# @param filesystem [String, nil] e.g., "xfs"
# @param size [Y2Storage::DiskSize]
def partition_config(name: nil, filesystem: nil, size: nil)
  config = Agama::Storage::Configs::Partition.new
  block_device_config(config, name: name, filesystem: filesystem)

  if size
    config.size = Agama::Storage::Configs::Size.new.tap do |size_config|
      size_config.min = size
      size_config.max = size
    end
  end

  config
end

describe Y2Storage::AgamaProposal do
  include Agama::RSpec::StorageHelpers

  let(:initial_config) do
    Agama::Storage::Config.new.tap do |settings|
      settings.drives = drives
    end
  end

  let(:issues_list) { [] }

  let(:drives) { [drive0] }

  let(:drive0) { Agama::Storage::Configs::Drive.new.tap { |d| d.partitions = partitions0 } }

  let(:partitions0) { [root_partition] }

  let(:root_partition) do
    Agama::Storage::Configs::Partition.new.tap do |part|
      part.filesystem = Agama::Storage::Configs::Filesystem.new.tap do |fs|
        fs.path = "/"
        fs.type = Agama::Storage::Configs::FilesystemType.new.tap do |type|
          type.fs_type = Y2Storage::Filesystems::Type::BTRFS
        end
      end
      part.size = Agama::Storage::Configs::Size.new.tap do |size|
        size.min = 8.5.GiB
        size.max = Y2Storage::DiskSize.unlimited
      end
    end
  end

  let(:home_partition) do
    Agama::Storage::Configs::Partition.new.tap do |part|
      part.filesystem = Agama::Storage::Configs::Filesystem.new.tap do |fs|
        fs.path = "/home"
        fs.type = Agama::Storage::Configs::FilesystemType.new.tap do |type|
          type.fs_type = Y2Storage::Filesystems::Type::EXT4
        end
      end
      part.size = Agama::Storage::Configs::Size.new.tap do |size|
        size.min = 10.GiB
        size.max = Y2Storage::DiskSize.unlimited
      end
    end
  end

  before do
    mock_storage(devicegraph: scenario)
  end

  subject(:proposal) do
    described_class.new(initial_config, issues_list: issues_list)
  end

  let(:scenario) { "empty-hd-50GiB.yaml" }

  describe "#propose" do
    context "when only the root partition is specified" do
      context "if no configuration about boot devices is specified" do
        it "proposes to create the root device and the boot-related partition" do
          proposal.propose
          partitions = proposal.devices.partitions
          expect(partitions.size).to eq 2
          expect(partitions.first.id).to eq Y2Storage::PartitionId::BIOS_BOOT
          root_part = partitions.last
          expect(root_part.size).to be > 49.GiB
          root_fs = root_part.filesystem
          expect(root_fs.root?).to eq true
          expect(root_fs.type.is?(:btrfs)).to eq true
        end
      end

      context "if no boot devices should be created" do
        before do
          initial_config.boot = Agama::Storage::Configs::Boot.new.tap { |b| b.configure = false }
        end

        it "proposes to create only the root device" do
          proposal.propose
          partitions = proposal.devices.partitions
          expect(partitions.size).to eq 1
          root_part = partitions.first
          expect(root_part.id).to eq Y2Storage::PartitionId::LINUX
          expect(root_part.size).to be > 49.GiB
          root_fs = root_part.filesystem
          expect(root_fs.root?).to eq true
          expect(root_fs.type.is?(:btrfs)).to eq true
        end
      end
    end

    context "when the config has 2 drives" do
      let(:scenario) { "disks.yaml" }

      let(:drives) { [drive0, drive1] }

      let(:drive1) do
        Agama::Storage::Configs::Drive.new.tap { |d| d.partitions = [home_partition] }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        root = devicegraph.find_by_name("/dev/vda4")
        expect(root.filesystem.mount_path).to eq("/")

        home = devicegraph.find_by_name("/dev/vdb1")
        expect(home.filesystem.mount_path).to eq("/home")
      end
    end

    context "when trying to reuse a file system from a drive" do
      let(:scenario) { "disks.yaml" }

      let(:drives) { [drive] }

      let(:drive) do
        drive_config(name: name, filesystem: "ext3").tap { |c| c.filesystem.reuse = true }
      end

      context "if the drive is already formatted" do
        let(:name) { "/dev/vdc" }

        it "reuses the file system" do
          vdc = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vdc")
          fs_sid = vdc.filesystem.sid

          devicegraph = proposal.propose

          filesystem = devicegraph.find_by_name("/dev/vdc").filesystem
          expect(filesystem.sid).to eq(fs_sid)
        end
      end

      context "if the drive is not formatted" do
        let(:name) { "/dev/vdb" }

        it "creates the file system" do
          devicegraph = proposal.propose

          filesystem = devicegraph.find_by_name("/dev/vdb").filesystem
          expect(filesystem).to_not be_nil
          expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
        end
      end
    end

    context "when a partition table type is specified for a drive" do
      let(:drive0) do
        Agama::Storage::Configs::Drive.new.tap do |drive|
          drive.partitions = partitions0
          drive.ptable_type = Y2Storage::PartitionTables::Type::MSDOS
        end
      end

      it "tries to propose a partition table of the requested type" do
        proposal.propose
        ptable = proposal.devices.disks.first.partition_table
        expect(ptable.type).to eq Y2Storage::PartitionTables::Type::MSDOS
      end

      it "honors the partition table type if possible when calculating the boot partitions" do
        proposal.propose
        partitions = proposal.devices.partitions
        expect(partitions.map(&:id)).to_not include Y2Storage::PartitionId::BIOS_BOOT
      end
    end

    context "when encrypting some devices" do
      let(:partitions0) { [root_partition, home_partition] }

      let(:home_encryption) do
        Agama::Storage::Configs::Encryption.new.tap do |enc|
          enc.password = "notSecreT"
          enc.method = encryption_method
        end
      end

      let(:encryption_method) { Y2Storage::EncryptionMethod::LUKS2 }
      let(:available?) { true }

      before do
        allow(encryption_method).to receive(:available?).and_return(available?) if encryption_method
        home_partition.encryption = home_encryption
      end

      context "if the encryption settings contain all the detailed information" do
        let(:home_encryption) do
          Agama::Storage::Configs::Encryption.new.tap do |enc|
            enc.password = "notSecreT"
            enc.method = encryption_method
            enc.pbkd_function = Y2Storage::PbkdFunction::ARGON2I
            enc.label = "luks_label"
            enc.cipher = "aes-xts-plain64"
            enc.key_size = 512
          end
        end

        it "proposes the right encryption layer" do
          proposal.propose
          partition = proposal.devices.partitions.find do |part|
            part.blk_filesystem&.mount_path == "/home"
          end
          expect(partition.encrypted?).to eq true
          expect(partition.encryption).to have_attributes(
            method:   Y2Storage::EncryptionMethod::LUKS2,
            password: "notSecreT",
            pbkdf:    Y2Storage::PbkdFunction::ARGON2I,
            label:    "luks_label",
            cipher:   "aes-xts-plain64",
            # libstorage-ng uses bytes instead of bits to represent the key size, contrary to
            # all LUKS documentation and to cryptsetup
            key_size: 64
          )
        end
      end

      context "if the encryption method is not available for this system" do
        let(:available?) { false }

        it "aborts the proposal process" do
          proposal.propose
          expect(proposal.failed?).to eq true
        end

        it "reports the corresponding error" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /method 'luks2' is not available/,
            severity:    Agama::Issue::Severity::ERROR
          )
        end
      end

      context "if the encryption method is not suitable" do
        let(:encryption_method) { Y2Storage::EncryptionMethod::RANDOM_SWAP }

        it "aborts the proposal process" do
          proposal.propose
          expect(proposal.failed?).to eq true
        end

        it "reports the corresponding error" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /'random_swap' is not a suitable method/,
            severity:    Agama::Issue::Severity::ERROR
          )
        end
      end

      context "if the method requires a password but none is provided" do
        let(:home_encryption) do
          Agama::Storage::Configs::Encryption.new.tap do |enc|
            enc.method = encryption_method
          end
        end

        it "aborts the proposal process" do
          proposal.propose
          expect(proposal.failed?).to eq true
        end

        it "reports the corresponding error" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /No passphrase provided/,
            severity:    Agama::Issue::Severity::ERROR
          )
        end
      end
    end

    context "when there are more drives than disks in the system" do
      let(:drives) { [drive0, drive1] }
      let(:drive1) do
        Agama::Storage::Configs::Drive.new.tap do |drive|
          drive.search = Agama::Storage::Configs::Search.new.tap do |search|
            search.if_not_found = if_not_found
          end
        end
      end

      context "if if_not_found is set to :skip for the surplus drive" do
        let(:if_not_found) { :skip }

        it "calculates a proposal if possible" do
          proposal.propose
          expect(proposal.failed?).to eq false
        end

        it "registers a non-critical issue" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /optional drive/,
            severity:    Agama::Issue::Severity::WARN
          )
        end
      end

      context "if if_not_found is set to :error for the surplus drive" do
        let(:if_not_found) { :error }

        it "aborts the proposal" do
          proposal.propose
          expect(proposal.failed?).to eq true
        end

        it "registers a critical issue" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /mandatory drive/,
            severity:    Agama::Issue::Severity::ERROR
          )
        end
      end
    end

    context "when searching for an existent drive" do
      let(:scenario) { "disks.yaml" }

      before do
        drive0.search.name = "/dev/vdb"
      end

      it "uses the drive" do
        proposal.propose

        root = proposal.devices.partitions.find do |part|
          part.filesystem&.mount_path == "/"
        end

        expect(root.disk.name).to eq("/dev/vdb")
      end
    end

    context "when searching for any drive" do
      let(:scenario) { "disks.yaml" }

      let(:drives) { [drive0, drive1] }

      let(:drive0) do
        Agama::Storage::Configs::Drive.new.tap { |d| d.partitions = [root_partition] }
      end

      let(:drive1) do
        Agama::Storage::Configs::Drive.new.tap { |d| d.partitions = [home_partition] }
      end

      it "uses the first unassigned drive" do
        proposal.propose

        root = proposal.devices.partitions.find do |part|
          part.filesystem&.mount_path == "/"
        end

        home = proposal.devices.partitions.find do |part|
          part.filesystem&.mount_path == "/home"
        end

        expect(root.disk.name).to eq("/dev/vda")
        expect(home.disk.name).to eq("/dev/vdb")
      end
    end

    context "when searching for a missing partition" do
      let(:partitions0) { [root_partition, missing_partition] }
      let(:missing_partition) do
        Agama::Storage::Configs::Partition.new.tap do |part|
          part.search = Agama::Storage::Configs::Search.new.tap do |search|
            search.if_not_found = if_not_found
          end
        end
      end

      context "if if_not_found is set to :skip" do
        let(:if_not_found) { :skip }

        it "calculates a proposal if possible" do
          proposal.propose
          expect(proposal.failed?).to eq false
        end

        it "registers a non-critical issue" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /optional partition/,
            severity:    Agama::Issue::Severity::WARN
          )
        end
      end

      context "if if_not_found is set to :error" do
        let(:if_not_found) { :error }

        it "aborts the proposal" do
          proposal.propose
          expect(proposal.failed?).to eq true
        end

        it "registers a critical issue" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /mandatory partition/,
            severity:    Agama::Issue::Severity::ERROR
          )
        end
      end
    end

    context "when searching for an existent partition" do
      let(:scenario) { "disks.yaml" }

      let(:partitions0) { [root_partition, home_partition] }

      before do
        home_partition.search = Agama::Storage::Configs::Search.new.tap do |search|
          search.name = "/dev/vda3"
        end
      end

      it "reuses the partition" do
        vda3 = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3")
        proposal.propose

        partition = proposal.devices.find_by_name("/dev/vda3")
        expect(partition.sid).to eq(vda3.sid)
        expect(partition.filesystem.mount_path).to eq("/home")
      end
    end

    context "when searching for any partition" do
      let(:scenario) { "disks.yaml" }

      let(:partitions0) { [root_partition, home_partition] }

      before do
        home_partition.search = Agama::Storage::Configs::Search.new
      end

      # TODO: Is this correct? The first partition (boot partition) is reused for home.
      it "reuses the first unassigned partition" do
        vda1 = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda1")
        proposal.propose

        partition = proposal.devices.find_by_name("/dev/vda1")
        expect(partition.sid).to eq(vda1.sid)
        expect(partition.filesystem.mount_path).to eq("/home")
      end

      it "does not reuse the same partition twice" do
        vda1 = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda1")
        vda2 = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda2")
        root_partition.search = Agama::Storage::Configs::Search.new
        proposal.propose

        root = proposal.devices.find_by_name("/dev/vda1")
        expect(root.sid).to eq(vda1.sid)
        expect(root.filesystem.mount_path).to eq("/")

        home = proposal.devices.find_by_name("/dev/vda2")
        expect(home.sid).to eq(vda2.sid)
        expect(home.filesystem.mount_path).to eq("/home")
      end
    end

    context "forcing to delete some partitions" do
      let(:scenario) { "disks.yaml" }

      let(:partitions0) { [root_partition, vda2, vda3] }

      let(:vda2) do
        partition_config(name: "/dev/vda2").tap { |c| c.delete = true }
      end

      let(:vda3) do
        partition_config(name: "/dev/vda3").tap { |c| c.delete = true }
      end

      before do
        drive0.search.name = "/dev/vda"
      end

      it "deletes the partitions" do
        vda1_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda1").sid
        vda2_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda2").sid
        vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

        devicegraph = proposal.propose

        expect(devicegraph.find_device(vda1_sid)).to_not be_nil
        expect(devicegraph.find_device(vda2_sid)).to be_nil
        expect(devicegraph.find_device(vda3_sid)).to be_nil

        root = devicegraph.find_by_name("/dev/vda2")
        expect(root.filesystem.mount_path).to eq("/")
      end
    end

    context "allowing to delete some partition" do
      let(:scenario) { "disks.yaml" }

      let(:partitions0) { [root_partition, vda3] }

      let(:vda3) do
        partition_config(name: "/dev/vda3").tap { |c| c.delete_if_needed = true }
      end

      before do
        # vda has 18 GiB of free space.
        drive0.search.name = "/dev/vda"
      end

      context "if deleting the partition is not needed" do
        before do
          root_partition.size.min = 15.GiB
        end

        it "does not delete the partition" do
          vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

          devicegraph = proposal.propose
          expect(devicegraph.find_device(vda3_sid)).to_not be_nil

          root = devicegraph.find_by_name("/dev/vda4")
          expect(root.filesystem.mount_path).to eq("/")
        end
      end

      context "if the partition has to be deleted" do
        before do
          root_partition.size.min = 20.GiB
        end

        it "deletes the partition" do
          vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

          devicegraph = proposal.propose
          expect(devicegraph.find_device(vda3_sid)).to be_nil

          root = devicegraph.find_by_name("/dev/vda3")
          expect(root.filesystem.mount_path).to eq("/")
        end
      end
    end

    # Testing precedence. This configuration should not be possible.
    context "if the partition config indicates both force to delete and allow to delete" do
      let(:scenario) { "disks.yaml" }

      let(:partitions0) { [root_partition, vda3] }

      let(:vda3) do
        partition_config(name: "/dev/vda3").tap do |config|
          config.delete = true
          config.delete_if_needed = true
        end
      end

      before do
        drive0.search.name = "/dev/vda"
      end

      it "deletes the partition" do
        vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

        devicegraph = proposal.propose
        expect(devicegraph.find_device(vda3_sid)).to be_nil

        root = devicegraph.find_by_name("/dev/vda3")
        expect(root.filesystem.mount_path).to eq("/")
      end
    end

    context "when reusing a partition" do
      let(:scenario) { "disks.yaml" }

      let(:drives) { [drive] }

      let(:drive) do
        drive_config.tap { |c| c.partitions = [partition] }
      end

      let(:partition) { partition_config(name: name, filesystem: "ext3") }

      context "if trying to reuse the file system" do
        before do
          partition.filesystem.reuse = true
        end

        context "and the partition is already formatted" do
          let(:name) { "/dev/vda2" }

          it "reuses the file system" do
            vda2 = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda2")
            fs_sid = vda2.filesystem.sid

            devicegraph = proposal.propose

            filesystem = devicegraph.find_by_name("/dev/vda2").filesystem
            expect(filesystem.sid).to eq(fs_sid)
          end
        end

        context "and the partition is not formatted" do
          let(:name) { "/dev/vda1" }

          it "creates the file system" do
            devicegraph = proposal.propose

            filesystem = devicegraph.find_by_name("/dev/vda1").filesystem
            expect(filesystem).to_not be_nil
            expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
          end
        end
      end

      context "if not trying to reuse the file system" do
        before do
          partition.filesystem.reuse = false
        end

        context "and the partition is already formatted" do
          let(:name) { "/dev/vda2" }

          it "creates the file system" do
            vda2 = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda2")
            fs_sid = vda2.filesystem.sid

            devicegraph = proposal.propose

            filesystem = devicegraph.find_by_name("/dev/vda2").filesystem
            expect(filesystem.sid).to_not eq(fs_sid)
            expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
          end
        end

        context "and the partition is not formatted" do
          let(:name) { "/dev/vda1" }

          it "creates the file system" do
            devicegraph = proposal.propose

            filesystem = devicegraph.find_by_name("/dev/vda1").filesystem
            expect(filesystem).to_not be_nil
            expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
          end
        end
      end
    end

    context "when creating a new partition" do
      let(:scenario) { "disks.yaml" }

      let(:drives) { [drive] }

      let(:drive) do
        drive_config.tap { |c| c.partitions = [partition] }
      end

      let(:partition) { partition_config(filesystem: "ext3", size: 1.GiB) }

      context "if trying to reuse the file system" do
        before do
          partition.filesystem.reuse = true
        end

        it "creates the file system" do
          devicegraph = proposal.propose

          filesystem = devicegraph.find_by_name("/dev/vda4").filesystem
          expect(filesystem).to_not be_nil
          expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
        end
      end

      context "if not trying to reuse the file system" do
        before do
          partition.filesystem.reuse = false
        end

        it "creates the file system" do
          devicegraph = proposal.propose

          filesystem = devicegraph.find_by_name("/dev/vda4").filesystem
          expect(filesystem).to_not be_nil
          expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
        end
      end
    end

    context "when the config has LVM volume groups" do
      let(:scenario) { "empty-hd-50GiB.yaml" }

      let(:initial_config) do
        Agama::Storage::ConfigConversions::FromJSON
          .new(config_json, product_config: product_config)
          .convert
      end

      let(:product_config) { Agama::Config.new }

      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                {
                  alias: "system-pv",
                  size:  "40 GiB"
                },
                {
                  alias: "vg1-pv",
                  size:  "5 GiB"
                }
              ]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              extentSize:      "2 MiB",
              physicalVolumes: ["system-pv"],
              logicalVolumes:  [
                {
                  name:       "root",
                  size:       "10 GiB",
                  filesystem: {
                    path: "/",
                    type: "btrfs"
                  },
                  encryption: {
                    luks2: { password: "12345" }
                  }
                },
                {
                  alias:      "system-pool",
                  name:       "pool",
                  pool:       true,
                  size:       "20 GiB",
                  stripes:    10,
                  stripeSize: "4 KiB"
                },
                {
                  name:       "data",
                  size:       "50 GiB",
                  usedPool:   "system-pool",
                  filesystem: { type: "xfs" }
                }
              ]
            },
            {
              name:            "vg1",
              physicalVolumes: ["vg1-pv"],
              logicalVolumes:  [
                {
                  name:       "home",
                  filesystem: {
                    path: "/home",
                    type: "xfs"
                  }
                }
              ]
            }
          ]
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.lvm_vgs).to contain_exactly(
          an_object_having_attributes(
            vg_name:     "system",
            extent_size: 2.MiB
          ),
          an_object_having_attributes(
            vg_name:     "vg1",
            extent_size: 4.MiB
          )
        )

        system_vg = devicegraph.find_by_name("/dev/system")
        system_pvs = system_vg.lvm_pvs.map(&:plain_blk_device)
        system_lvs = system_vg.lvm_lvs
        expect(system_pvs).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda2", size: 40.GiB)
        )
        expect(system_lvs).to contain_exactly(
          an_object_having_attributes(
            lv_name:    "root",
            lv_type:    Y2Storage::LvType::NORMAL,
            size:       10.GiB,
            filesystem: an_object_having_attributes(
              type:       Y2Storage::Filesystems::Type::BTRFS,
              mount_path: "/"
            ),
            encryption: an_object_having_attributes(
              type:     Y2Storage::EncryptionType::LUKS2,
              password: "12345"
            )
          ),
          an_object_having_attributes(
            lv_name:     "pool",
            lv_type:     Y2Storage::LvType::THIN_POOL,
            size:        20.GiB,
            filesystem:  be_nil,
            encryption:  be_nil,
            stripes:     10,
            stripe_size: 4.KiB,
            lvm_lvs:     contain_exactly(
              an_object_having_attributes(
                lv_name:    "data",
                lv_type:    Y2Storage::LvType::THIN,
                size:       50.GiB,
                filesystem: an_object_having_attributes(
                  type: Y2Storage::Filesystems::Type::XFS
                )
              )
            )
          )
        )

        vg1 = devicegraph.find_by_name("/dev/vg1")
        vg1_pvs = vg1.lvm_pvs.map(&:plain_blk_device)
        vg1_lvs = vg1.lvm_lvs
        expect(vg1_pvs).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda3", size: 5.GiB)
        )
        expect(vg1_lvs).to contain_exactly(
          an_object_having_attributes(
            lv_name:    "home",
            lv_type:    Y2Storage::LvType::NORMAL,
            size:       5.GiB - 4.MiB,
            filesystem: an_object_having_attributes(
              type:       Y2Storage::Filesystems::Type::XFS,
              mount_path: "/home"
            )
          )
        )
      end
    end
  end
end
