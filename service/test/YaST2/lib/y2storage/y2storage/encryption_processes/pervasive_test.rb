#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019-2020] SUSE LLC
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

# For a complete pervasive encryption test, see test/y2storage/pervasive_encryption_test.rb
describe Y2Storage::EncryptionProcesses::Pervasive do
  include_context "yast2-storage-ng test setup"

  subject(:process) { described_class.new(method) }

  let(:method) { double }
  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }
  let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, "/dev/sda") }
  let(:dm_name) { "cr_sda" }
  let(:secure_key) { nil }
  let(:block_size) { Y2Storage::DiskSize.new(4096) }
  let(:region) { instance_double(Y2Storage::Region, block_size: block_size) }

  let(:zkey_cryptsetup) do
    "cryptsetup luksFormat --foo bar --dummy /dev/dasdc1\n" \
      "zkey-cryptsetup setvp --volumes /dev/dasdc1\n" \
      "third-command"
  end

  before do
    devicegraph_stub("empty_hard_disk_50GiB.yml")
    allow(Yast::Execute).to receive(:locally)
      .with(/zkey/, "cryptsetup", "--volumes", "/dev/dasdc1", anything)
      .and_return(zkey_cryptsetup)
    allow(Y2Storage::EncryptionProcesses::SecureKey).to receive(:for_device)
      .and_return(secure_key)
    allow(blk_device).to receive(:region).and_return(region)
  end

  describe "#create_device" do
    it "returns an encryption device" do
      encryption = process.create_device(blk_device, dm_name)
      expect(encryption.is?(:encryption)).to eq(true)
      expect(encryption.dm_table_name).to eq("cr_sda")
    end

    it "creates an luks2 encryption device for given block device" do
      encryption = process.create_device(blk_device, dm_name)
      expect(encryption.type).to eq(Y2Storage::EncryptionType::LUKS2)
    end

    context "when a secure key for the device was found" do
      let(:secure_key) do
        instance_double(Y2Storage::EncryptionProcesses::SecureKey, dm_name: "cr_custom")
      end

      it "uses the dm name from the key" do
        encryption = process.create_device(blk_device, dm_name)
        expect(encryption.dm_table_name).to eq("cr_custom")
      end
    end

    it "does not set any option for secure key" do
      encryption = subject.create_device(blk_device, dm_name)
      expect(encryption.crypt_options).to be_empty
    end

    it "does not set any open option for secure key" do
      encryption = subject.create_device(blk_device, dm_name)
      expect(encryption.open_options).to be_empty
    end
  end

  describe "#pre_commit" do
    let(:encryption) { subject.create_device(blk_device, dm_name, apqns: [apqn]) }

    let(:secure_key) { nil }

    let(:apqn) do
      instance_double(Y2Storage::EncryptionProcesses::Apqn, name: "01.0001", ep11?: false)
    end

    let(:generated_key) do
      instance_double(Y2Storage::EncryptionProcesses::SecureKey,
        plain_name: "/dev/dasdc1", dm_name: "cr_1", name: "secure_xtskey1",
        filename: "/etc/zkey/repository/secure_xtskey1.skey", secure_key_size: 128)
    end

    before do
      allow(Y2Storage::EncryptionProcesses::SecureKey).to receive(:generate)
        .and_return(generated_key)
      allow(encryption).to receive(:blk_device).and_return(blk_device)
    end

    it "generates a new secure key for the device" do
      expect(Y2Storage::EncryptionProcesses::SecureKey).to receive(:generate)
        .with("YaST_cr_sda", sector_size: 4096, apqns: [apqn], key_type: "CCA-AESCIPHER")
        .and_return(generated_key)
      subject.pre_commit(encryption)
    end

    context "when the block size of the underlying device is greater than 4k" do
      let(:block_size) { Y2Storage::DiskSize.new(8192) }

      it "sets the sector-size for the encryption key to 4096" do
        subject.pre_commit(encryption)
        expect(encryption.format_options).to include("--sector-size 4096")
      end
    end

    context "when the block size of the underlying device is 4k" do
      let(:block_size) { Y2Storage::DiskSize.new(4096) }

      it "sets the sector-size for the encryption key to 4096" do
        subject.pre_commit(encryption)
        expect(encryption.format_options).to include("--sector-size 4096")
      end
    end

    context "when the block size of the underlying device less than 4k" do
      let(:block_size) { Y2Storage::DiskSize.new(2048) }

      it "does not set the sector-size for the encryption key" do
        subject.pre_commit(encryption)
        expect(encryption.format_options).to_not include("--sector-size")
      end
    end

    context "when a secure key for the device was found" do
      let(:secure_key) { generated_key }

      it "does not generate a new secure key" do
        expect(Y2Storage::EncryptionProcesses::SecureKey).to_not receive(:generate)
        subject.pre_commit(encryption)
      end
    end

    it "sets LUKS format options" do
      subject.pre_commit(encryption)
      expect(encryption.format_options).to include("--master-key-file "\
                                                   "/etc/zkey/repository/secure_xtskey1.skey")
      expect(encryption.format_options).to include("--key-size 1024")
      expect(encryption.format_options).to include("--cipher paes-xts-plain64")
      expect(encryption.format_options).to include("--pbkdf pbkdf2")
    end
  end

  describe "#post_commit" do
    let(:encryption) { subject.create_device(blk_device, dm_name) }

    let(:secure_key) do
      instance_double(Y2Storage::EncryptionProcesses::SecureKey,
        plain_name: "/dev/dasdc1", dm_name: "cr_1", name: "secure_xtskey1",
        filename: "/etc/zkey/repository/secure_xtskey1.skey", secure_key_size: 128)
    end

    let(:secure_key_volume) do
      instance_double(Y2Storage::EncryptionProcesses::SecureKeyVolume,
        plain_name: "/dev/dasdc1", dm_name: "cr_1", to_s: "/dev/dasdc1:cr_1")
    end

    before do
      subject.pre_commit(encryption)
    end

    it "executes commands reported by zkey cryptsetup skipping the first one" do
      allow(secure_key).to receive(:for_device?).and_return(false)
      expect(secure_key).to receive(:add_device_and_write).and_return(secure_key_volume)
      expect(Yast::Execute).to receive(:locally).with(/zkey-cryptsetup/, any_args)
      expect(Yast::Execute).to receive(:locally).with("third-command")
      subject.post_commit(encryption)
    end

    it "executes commands reported by zkey cryptsetup skipping the first one" do
      allow(secure_key).to receive(:for_device?).and_return(true)
      expect(secure_key).to_not receive(:add_device)
      expect(Yast::Execute).to receive(:locally).with(/zkey-cryptsetup/, any_args)
      expect(Yast::Execute).to receive(:locally).with("third-command")
      subject.post_commit(encryption)
    end

    it "adds the --key-file option to the setvp command" do
      allow(secure_key).to receive(:for_device?).and_return(true)
      expect(Yast::Execute).to receive(:locally).with(/zkey/, "cryptsetup", "--volumes",
        "/dev/dasdc1", any_args)
      expect(Yast::Execute).to receive(:locally).with(/zkey-cryptsetup/, "setvp", "--volumes",
        "/dev/dasdc1", "--key-file", "-", any_args)
      expect(Yast::Execute).to receive(:locally).with("third-command")
      subject.post_commit(encryption)
    end
  end
end
