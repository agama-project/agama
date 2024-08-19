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
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  include Agama::RSpec::StorageHelpers

  before do
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
  end

  subject(:proposal) do
    described_class.new(initial_settings, issues_list: issues_list)
  end
  let(:initial_settings) do
    Agama::Storage::Config.new.tap do |settings|
      settings.drives = drives
    end
  end
  let(:issues_list) { [] }
  let(:drives) { [drive0] }
  let(:drive0) { Agama::Storage::Configs::Drive.new.tap { |d| d.partitions = partitions0 } }
  let(:partitions0) { [root_partition ] }
  let(:root_partition) do
    Agama::Storage::Configs::Partition.new.tap do |part|
      part.filesystem = Agama::Storage::Configs::Filesystem.new.tap do |fs|
        fs.path = "/"
        fs.type = Agama::Storage::Configs::FilesystemType.new.tap do |type|
          type.fs_type = Y2Storage::Filesystems::Type::BTRFS
        end
      end
      part.size = Agama::Storage::Configs::Size.new.tap do |size|
        size.min = Y2Storage::DiskSize.GiB(8.5)
        size.max = Y2Storage::DiskSize.unlimited
      end
    end
  end

  describe "#propose" do
    context "when only the root partition is specified" do
      context "if no configuration about boot devices is specified" do
        it "proposes to create the root device and the boot-related partition" do
          proposal.propose
          partitions = proposal.devices.partitions
          expect(partitions.size).to eq 2
          expect(partitions.first.id).to eq Y2Storage::PartitionId::BIOS_BOOT
          root_part = partitions.last
          expect(root_part.size).to be > Y2Storage::DiskSize.GiB(49)
          root_fs = root_part.filesystem
          expect(root_fs.root?).to eq true
          expect(root_fs.type.is?(:btrfs)).to eq true
        end
      end

      context "if no boot devices should be created" do
        before do
          initial_settings.boot = Agama::Storage::Configs::Boot.new.tap { |b| b.configure = false }
        end

        it "proposes to create only the root device" do
          proposal.propose
          partitions = proposal.devices.partitions
          expect(partitions.size).to eq 1
          root_part = partitions.first
          expect(root_part.id).to eq Y2Storage::PartitionId::LINUX
          expect(root_part.size).to be > Y2Storage::DiskSize.GiB(49)
          root_fs = root_part.filesystem
          expect(root_fs.root?).to eq true
          expect(root_fs.type.is?(:btrfs)).to eq true
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
      let(:partitions0) { [root_partition, home_partition ] }

      let(:home_partition) do
        Agama::Storage::Configs::Partition.new.tap do |part|
          part.filesystem = Agama::Storage::Configs::Filesystem.new.tap do |fs|
            fs.path = "/home"
            fs.type = Agama::Storage::Configs::FilesystemType.new.tap do |type|
              type.fs_type = Y2Storage::Filesystems::Type::EXT4
            end
          end
          part.size = Agama::Storage::Configs::Size.new.tap do |size|
            size.min = Y2Storage::DiskSize.GiB(10)
            size.max = Y2Storage::DiskSize.unlimited
          end
          part.encryption = home_encryption
        end
      end

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
            method: Y2Storage::EncryptionMethod::LUKS2,
            password: "notSecreT",
            pbkdf: Y2Storage::PbkdFunction::ARGON2I,
            label: "luks_label",
            cipher: "aes-xts-plain64",
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
            severity: Agama::Issue::Severity::ERROR
          )
        end
      end

      context "if the encryption method is not available for this system" do
        let(:encryption_method) { Y2Storage::EncryptionMethod::RANDOM_SWAP }

        it "aborts the proposal process" do
          proposal.propose
          expect(proposal.failed?).to eq true
        end

        it "reports the corresponding error" do
          proposal.propose
          expect(proposal.issues_list).to include an_object_having_attributes(
            description: /'random_swap' is not a suitable method/,
            severity: Agama::Issue::Severity::ERROR
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
            severity: Agama::Issue::Severity::ERROR
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
            severity: Agama::Issue::Severity::WARN
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
            severity: Agama::Issue::Severity::ERROR
          )
        end
      end
    end

    context "when searching for a non-existent partition" do
      let(:partitions0) { [root_partition, existing_partition ] }
      let(:existing_partition) do
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
            severity: Agama::Issue::Severity::WARN
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
            severity: Agama::Issue::Severity::ERROR
          )
        end
      end
    end
  end
end
