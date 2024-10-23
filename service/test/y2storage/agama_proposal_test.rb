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

  config.size = Agama::Storage::Configs::Size.new.tap do |size_config|
    size_config.min = size || Y2Storage::DiskSize.zero
    size_config.max = size || Y2Storage::DiskSize.unlimited
  end

  config
end

describe Y2Storage::AgamaProposal do
  include Agama::RSpec::StorageHelpers

  subject(:proposal) do
    described_class.new(config, product_config: product_config, issues_list: issues_list)
  end

  let(:config) { config_json ? config_from_json : default_config }

  let(:config_from_json) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json, default_paths: default_paths, mandatory_paths: mandatory_paths)
      .convert
  end

  let(:default_config) do
    Agama::Storage::Config.new.tap do |settings|
      settings.drives = drives
    end
  end

  let(:config_json) { nil }

  let(:product_config) { Agama::Config.new(product_data) }

  let(:product_data) do
    {
      "storage" => {
        "lvm"              => false,
        "space_policy"     => "delete",
        "encryption"       => {
          "method" => "luks2"
        },
        "volumes"          => ["/", "swap"],
        "volume_templates" => [
          {
            "mount_path" => "/",
            "filesystem" => "btrfs",
            "size"       => { "auto" => true },
            "btrfs"      => {
              "snapshots"         => true,
              "default_subvolume" => "@",
              "subvolumes"        => ["home", "opt", "root", "srv"]
            },
            "outline"    => {
              "required"               => true,
              "snapshots_configurable" => true,
              "filesystems"            => ["btrfs", "xfs", "ext3", "ext4"],
              "auto_size"              => {
                "base_min"            => "5 GiB",
                "base_max"            => "10 GiB",
                "min_fallback_for"    => ["/home"],
                "max_fallback_for"    => ["/home"],
                "snapshots_increment" => "300%"
              }
            }
          },
          {
            "mount_path" => "/home",
            "size"       => { "auto" => false, "min" => "5 GiB" },
            "filesystem" => "xfs",
            "outline"    => {
              "required"    => false,
              "filesystems" => ["xfs", "ext4"]
            }
          },
          {
            "mount_path" => "swap",
            "filesystem" => "swap",
            "outline"    => {
              "required"    => false,
              "filesystems" => ["swap"]
            }
          },
          {
            "mount_path" => "",
            "filesystem" => "ext4",
            "size"       => { "min" => "100 MiB" },
            "outline"    => {
              "filesystems" => ["xfs", "ext4"]
            }
          }
        ]
      }
    }
  end

  let(:default_paths) { product_config.default_paths }

  let(:mandatory_paths) { product_config.mandatory_paths }

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
        size.default = false
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
    # To speed-up the tests
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
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
          config.boot = Agama::Storage::Configs::Boot.new.tap { |b| b.configure = false }
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

    context "when only 'default' partitions is specified" do
      let(:scenario) { "empty-hd-50GiB.yaml" }

      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                { generate: "default" }
              ]
            }
          ]
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.partitions.size).to eq(3)

        boot = devicegraph.find_by_name("/dev/sda1")
        expect(boot.id).to eq(Y2Storage::PartitionId::BIOS_BOOT)
        expect(boot.filesystem).to be_nil
        expect(boot.size).to eq(8.MiB)

        root = devicegraph.find_by_name("/dev/sda2")
        expect(root.filesystem.mount_path).to eq("/")
        expect(root.filesystem.type.is?(:btrfs)).to eq(true)
        expect(root.size).to be_between(44.99.GiB, 45.GiB)

        swap = devicegraph.find_by_name("/dev/sda3")
        expect(swap.filesystem.mount_path).to eq("swap")
        expect(swap.filesystem.type.is?(:swap)).to eq(true)
        expect(swap.size).to be_between(4.99.GiB, 5.GiB)
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
        home_partition.encryption = home_encryption

        # Mocking only the object at encryption_method introduces a problem with serialization
        allow_any_instance_of(Y2Storage::EncryptionMethod::Luks2)
          .to receive(:available?).and_return(available?)
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
            description: /method 'Regular LUKS2' is not available/,
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
            description: /'Encryption with Volatile Random Key' is not a suitable method/,
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
        home_partition.search = Agama::Storage::Configs::Search.new.tap { |s| s.max = 1 }
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
        root_partition.search = Agama::Storage::Configs::Search.new.tap { |s| s.max = 1 }
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

      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  search:     name,
                  filesystem: {
                    reuseIfPossible: reuse,
                    path:            "/",
                    type:            "ext3"
                  },
                  size:       size
                },
                {
                  filesystem: {
                    path: "/home"
                  }
                }
              ]
            }
          ]
        }
      end

      let(:reuse) { nil }

      let(:size) { nil }

      context "if trying to reuse the file system" do
        let(:reuse) { true }

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
        let(:reuse) { false }

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

      context "if no size is indicated" do
        let(:name) { "/dev/vda2" }

        let(:size) { nil }

        it "does not resize the partition" do
          devicegraph = proposal.propose

          vda2 = devicegraph.find_by_name("/dev/vda2")
          expect(vda2.size).to eq(20.GiB)
        end
      end
    end

    context "when creating a new partition" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives: [
            {
              partitions: [
                {
                  filesystem: {
                    reuseIfPossible: reuse,
                    path:            "/",
                    type:            "ext3"
                  },
                  size:       size
                },
                {
                  filesystem: {
                    path: "/home"
                  }
                }
              ]
            }
          ]
        }
      end

      let(:reuse) { nil }

      let(:size) { nil }

      context "if trying to reuse the file system" do
        let(:reuse) { true }

        it "creates the file system" do
          devicegraph = proposal.propose

          filesystem = devicegraph.find_by_name("/dev/vda4").filesystem
          expect(filesystem).to_not be_nil
          expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
        end
      end

      context "if not trying to reuse the file system" do
        let(:reuse) { false }

        it "creates the file system" do
          devicegraph = proposal.propose

          filesystem = devicegraph.find_by_name("/dev/vda4").filesystem
          expect(filesystem).to_not be_nil
          expect(filesystem.type).to eq(Y2Storage::Filesystems::Type::EXT3)
        end
      end

      context "if no size is indicated" do
        let(:size) { nil }

        it "creates the partition according to the size from the product definition" do
          devicegraph = proposal.propose

          expect(devicegraph.partitions).to include(
            an_object_having_attributes(
              filesystem: an_object_having_attributes(mount_path: "/"),
              size:       10.GiB - 1.MiB
            )
          )
        end
      end

      context "if a size is indicated" do
        let(:size) { "5 GiB" }

        it "creates the partition according to the given size" do
          devicegraph = proposal.propose

          expect(devicegraph.partitions).to include(
            an_object_having_attributes(
              filesystem: an_object_having_attributes(mount_path: "/"),
              size:       5.GiB
            )
          )
        end
      end

      context "if 'current' size is indicated" do
        let(:size) { { min: "current" } }

        it "creates the partition according to the size from the product definition" do
          devicegraph = proposal.propose

          expect(devicegraph.partitions).to include(
            an_object_having_attributes(
              filesystem: an_object_having_attributes(mount_path: "/"),
              size:       10.GiB - 1.MiB
            )
          )
        end
      end

      context "if the size is not indicated for some partition with fallbacks" do
        let(:scenario) { "empty-hd-50GiB.yaml" }

        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  {
                    filesystem: {
                      path: "/",
                      type: {
                        btrfs: { snapshots: snapshots }
                      }
                    }
                  },
                  {
                    filesystem: { path: other_path }
                  }
                ]
              }
            ]
          }
        end

        context "and the other partitions are omitted" do
          let(:other_path) { nil }
          let(:snapshots) { false }

          it "creates the partition adding the fallback sizes" do
            devicegraph = proposal.propose

            expect(devicegraph.partitions).to include(
              an_object_having_attributes(
                filesystem: an_object_having_attributes(mount_path: "/"),
                size:       29.95.GiB - 2.80.MiB
              )
            )
          end

          context "and snapshots are enabled" do
            let(:snapshots) { true }

            it "creates the partition adding the fallback and snapshots sizes" do
              devicegraph = proposal.propose

              expect(devicegraph.partitions).to include(
                an_object_having_attributes(
                  filesystem: an_object_having_attributes(mount_path: "/"),
                  size:       44.95.GiB - 2.80.MiB
                )
              )
            end
          end
        end

        context "and the other partitions are present" do
          let(:other_path) { "/home" }
          let(:snapshots) { false }

          it "creates the partition ignoring the fallback sizes" do
            devicegraph = proposal.propose

            expect(devicegraph.partitions).to include(
              an_object_having_attributes(
                filesystem: an_object_having_attributes(mount_path: "/"),
                size:       10.GiB
              )
            )
          end

          context "and snapshots are enabled" do
            let(:snapshots) { true }

            it "creates the partition adding the snapshots sizes" do
              devicegraph = proposal.propose

              expect(devicegraph.partitions).to include(
                an_object_having_attributes(
                  filesystem: an_object_having_attributes(mount_path: "/"),
                  size:       32.50.GiB - 4.MiB
                )
              )
            end
          end
        end
      end

      context "if the partition has to be enlarged according to RAM size" do
        let(:scenario) { "empty-hd-50GiB.yaml" }

        let(:product_data) do
          {
            "storage" => {
              "volume_templates" => [
                {
                  "mount_path" => "swap",
                  "filesystem" => "swap",
                  "size"       => { "auto" => true },
                  "outline"    => {
                    "filesystems" => ["swap"],
                    "auto_size"   => {
                      "adjust_by_ram" => true,
                      "base_min"      => "2 GiB",
                      "base_max"      => "4 GiB"
                    }
                  }
                }
              ]
            }
          }
        end

        let(:config_json) do
          {
            drives: [
              {
                partitions: [
                  {
                    filesystem: {
                      path: "swap"
                    },
                    size:       size
                  }
                ]
              }
            ]
          }
        end

        before do
          allow_any_instance_of(Y2Storage::Arch).to receive(:ram_size).and_return(8.GiB)
        end

        context "and the partition size is not indicated" do
          let(:size) { nil }

          it "creates the partition as big as the RAM" do
            devicegraph = proposal.propose

            expect(devicegraph.partitions).to include(
              an_object_having_attributes(
                filesystem: an_object_having_attributes(mount_path: "swap"),
                size:       8.GiB
              )
            )
          end
        end

        context "and the partition size is indicated" do
          let(:size) { "2 GiB" }

          it "creates the partition with the given size" do
            devicegraph = proposal.propose

            expect(devicegraph.partitions).to include(
              an_object_having_attributes(
                filesystem: an_object_having_attributes(mount_path: "swap"),
                size:       2.GiB
              )
            )
          end
        end
      end
    end

    context "resizing an existing partition" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives: [
            {
              search:     "/dev/vda",
              partitions: [
                {
                  filesystem: {
                    type: "btrfs",
                    path: "/"
                  },
                  size:       root_size
                },
                {
                  search: "/dev/vda3",
                  size:   vda3_size
                }
              ]
            }
          ]
        }
      end

      let(:root_size) { ["8.5 GiB"] }

      let(:vda3_size) { nil }

      before do
        allow_any_instance_of(Y2Storage::Partition)
          .to(receive(:detect_resize_info))
          .and_return(resize_info)
      end

      let(:resize_info) do
        instance_double(
          Y2Storage::ResizeInfo, resize_ok?: true,
          min_size: Y2Storage::DiskSize::GiB(3), max_size: Y2Storage::DiskSize::GiB(35)
        )
      end

      context "when the reused partition is expected to grow with no enforced limit" do
        let(:vda3_size) { ["current"] }

        it "grows the device as much as allowed by the min size of the new partitions" do
          vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

          devicegraph = proposal.propose

          vda3 = devicegraph.find_device(vda3_sid)
          expect(vda3).to_not be_nil

          root = devicegraph.find_by_name("/dev/vda4")
          expect(root.filesystem.mount_path).to eq("/")
          expect(vda3.size).to be > 21.GiB
          gpt_adjustment = 1.MiB - 16.5.KiB
          expect(root.size).to eq(8.5.GiB + gpt_adjustment)
        end
      end

      context "when the reused partition is expected to grow up to a limit" do
        let(:vda3_size) { ["10 GiB", "15 GiB"] }

        it "grows the device up to the limit so the new partitions can exceed their mins" do
          vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

          devicegraph = proposal.propose

          vda3 = devicegraph.find_device(vda3_sid)
          expect(vda3).to_not be_nil

          root = devicegraph.find_by_name("/dev/vda4")
          expect(root.filesystem.mount_path).to eq("/")
          expect(vda3.size).to eq 15.GiB
          expect(root.size).to be > 10.GiB
        end
      end

      context "when the reused partition is expected to shrink as much as needed" do
        let(:vda3_size) { ["0 KiB", "current"] }

        context "if there is no need to shrink the partition" do
          it "does not modify the size of the partition" do
            vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

            devicegraph = proposal.propose

            vda3 = devicegraph.find_device(vda3_sid)
            expect(vda3).to_not be_nil
            root = devicegraph.find_by_name("/dev/vda4")
            expect(root).to_not be_nil

            expect(vda3.size).to eq 10.GiB
          end
        end

        context "if the partition needs to be shrunk to allocate the new ones" do
          let(:root_size) { "24 GiB" }

          it "shrinks the partition as needed" do
            vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

            devicegraph = proposal.propose

            vda3 = devicegraph.find_device(vda3_sid)
            expect(vda3).to_not be_nil
            root = devicegraph.find_by_name("/dev/vda4")
            expect(root).to_not be_nil

            expect(vda3.size).to be < 6.GiB
            gpt_adjustment = 1.MiB - 16.5.KiB
            expect(root.size).to eq(24.GiB + gpt_adjustment)
          end
        end
      end

      context "when the reused partition is expected to shrink in all cases" do
        let(:vda3_size) { ["0 KiB", "6 GiB"] }

        context "if there is no need to shrink the partition" do
          it "shrinks the partition to the specified max size" do
            vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

            devicegraph = proposal.propose

            vda3 = devicegraph.find_device(vda3_sid)
            expect(vda3).to_not be_nil
            root = devicegraph.find_by_name("/dev/vda4")
            expect(root).to_not be_nil

            expect(vda3.size).to eq 6.GiB
          end
        end

        context "if the partition needs to be shrunk to allocate the new ones" do
          let(:root_size) { "25 Gib" }

          it "shrinks the partition as needed" do
            vda3_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/vda3").sid

            devicegraph = proposal.propose

            vda3 = devicegraph.find_device(vda3_sid)
            expect(vda3).to_not be_nil
            root = devicegraph.find_by_name("/dev/vda4")
            expect(root).to_not be_nil

            expect(vda3.size).to be < 5.GiB
            gpt_adjustment = 1.MiB - 16.5.KiB
            expect(root.size).to eq(25.GiB + gpt_adjustment)
          end
        end
      end
    end
  end
end
