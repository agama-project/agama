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

require "y2storage"

describe Y2Storage::EncryptionProcesses::Luks do
  include_context "yast2-storage-ng test setup"

  let(:method) { double }

  describe "#create_device" do
    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }
    let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, "/dev/sda") }
    let(:dm_name) { "cr_sda" }

    before do
      devicegraph_stub("empty_hard_disk_50GiB.yml")
    end

    context "when no LUKS version is specified" do
      subject(:process) { described_class.new(method) }

      it "returns an encryption device" do
        encryption = process.create_device(blk_device, dm_name)

        expect(encryption.is?(:encryption)).to eq(true)
      end

      it "creates an luks1 encryption device for given block device" do
        expect(blk_device).to receive(:create_encryption)
          .with(anything, Y2Storage::EncryptionType::LUKS1)
          .and_call_original

        process.create_device(blk_device, dm_name)
      end

      it "does not set any specific encryption option" do
        encryption = subject.create_device(blk_device, dm_name)

        expect(encryption.crypt_options).to be_empty
      end

      it "does not set any specific open option" do
        encryption = subject.create_device(blk_device, dm_name)

        expect(encryption.open_options).to be_empty
      end
    end

    context "when LUKS2 is used" do
      subject(:process) { described_class.new(method, :luks2) }

      it "returns an encryption device with the given label (if any is given)" do
        encryption = process.create_device(blk_device, dm_name, label: "lbl")

        expect(encryption.is?(:encryption)).to eq(true)
        expect(encryption.label).to eq "lbl"
      end

      it "creates an luks2 encryption device for given block device" do
        expect(blk_device).to receive(:create_encryption)
          .with(anything, Y2Storage::EncryptionType::LUKS2)
          .and_call_original

        process.create_device(blk_device, dm_name)
      end

      it "does not set any specific encryption option" do
        encryption = subject.create_device(blk_device, dm_name)

        expect(encryption.crypt_options).to be_empty
      end

      it "does not set any specific open option" do
        encryption = subject.create_device(blk_device, dm_name)

        expect(encryption.open_options).to be_empty
      end
    end
  end
end
