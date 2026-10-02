#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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
require "y2storage/encryption_processes/volatile"

describe Y2Storage::EncryptionProcesses::Volatile do
  include_context "yast2-storage-ng test setup"

  subject do
    described_class.new(
      method,
      key_file: key_file,
      cipher:   cipher,
      key_size: key_size
    )
  end

  let(:method) { instance_double(Y2Storage::EncryptionMethod::Base) }

  let(:key_file) { "/sys/some-key" }
  let(:cipher) { "paes-xts-plain64" }
  let(:key_size) { 1024 }

  describe "#create_device" do
    before do
      fake_scenario("empty_hard_disk_50GiB")
      allow(device).to receive(:region).and_return(region)
    end

    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:device) { devicegraph.find_by_name("/dev/sda") }

    let(:dm_name) { "cr_sda" }

    let(:block_size) { Y2Storage::DiskSize.new(4096) }

    let(:region) { instance_double(Y2Storage::Region, block_size: block_size) }

    it "returns an encryption device" do
      result = subject.create_device(device, dm_name)

      expect(result.is?(:encryption)).to eq(true)
    end

    it "creates an plain encryption device for the given device" do
      expect(device.encrypted?).to eq(false)

      subject.create_device(device, dm_name)

      expect(device.encrypted?).to eq(true)
      expect(device.encryption.type.is?(:plain)).to eq(true)
    end

    it "sets the key file" do
      encryption = subject.create_device(device, dm_name)

      expect(encryption.key_file).to eq(key_file)
    end

    it "sets the 'swap' encryption option" do
      encryption = subject.create_device(device, dm_name)

      expect(encryption.crypt_options).to include("swap")
    end

    it "sets the cipher encryption option" do
      encryption = subject.create_device(device, dm_name)
      expect(encryption.crypt_options).to include("cipher=paes-xts-plain64")
    end

    it "sets the cipher open option" do
      encryption = subject.create_device(device, dm_name)
      expect(encryption.open_options).to include("--cipher 'paes-xts-plain64'")
    end

    context "when the cipher is not defined" do
      let(:cipher) { nil }

      it "does not set the cipher encryption option" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.crypt_options).to_not include("cipher=paes-xts-plain64")
      end

      it "does not set the cipher open option" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.open_options).to_not include("--cipher 'paes-xts-plain64'")
      end
    end

    it "sets the key-size encryption option" do
      encryption = subject.create_device(device, dm_name)
      expect(encryption.crypt_options).to include("size=1024")
    end

    it "sets the key-size open option for secure key" do
      encryption = subject.create_device(device, dm_name)
      expect(encryption.open_options).to include("--key-size '1024'")
    end

    context "when the key size is not defined" do
      let(:key_size) { nil }

      it "does not set the key-size encryption option" do
        encryption = subject.create_device(device, dm_name)

        expect(encryption.crypt_options).to_not include("size=1024")
      end

      it "does not set the key-size open option for secure key" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.open_options).to_not include("--key-size '1024'")
      end
    end

    context "when the block size of the underlying device is greater than 4k" do
      let(:block_size) { Y2Storage::DiskSize.new(8192) }

      it "sets the sector-size encryption option to 4096" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.crypt_options).to include("sector-size=4096")
      end

      it "sets the sector-size open option for secure key" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.open_options).to include("--sector-size '4096'")
      end
    end

    context "when the block size of the underlying device is 4k" do
      let(:block_size) { Y2Storage::DiskSize.new(4096) }

      it "sets the sector-size encryption option to 4096" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.crypt_options).to include("sector-size=4096")
      end

      it "sets the sector-size open option for secure key" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.open_options).to include("--sector-size '4096'")
      end
    end

    context "when the block size of the underlying less than 4k" do
      let(:block_size) { Y2Storage::DiskSize.new(2048) }

      it "does not set the sector-size option" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.crypt_options).to_not include("sector-size=2048")
      end

      it "does not set the sector-size open option for secure key" do
        encryption = subject.create_device(device, dm_name)
        expect(encryption.open_options).to_not include("--sector-size '2048'")
      end
    end
  end
end
