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

describe Y2Storage::EncryptionProcesses::SystemdFde do
  include_context "yast2-storage-ng test setup"

  let(:method) { double }
  subject(:process) { described_class.new(method) }

  describe "#create_device" do
    context "with fido2 key support" do
      let(:devicegraph) { Y2Storage::StorageManager.instance.staging }
      let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, "/dev/sda") }
      let(:dm_name) { "cr_sda" }
      let(:authentication) { Y2Storage::EncryptionAuthentication.find("fido2") }

      before do
        devicegraph_stub("empty_hard_disk_50GiB.yml")
      end

      it "returns an encryption device with the given label (if any is given)" do
        encryption = process.create_device(blk_device, dm_name, authentication, label: "lbl")

        expect(encryption.is?(:encryption)).to eq(true)
        expect(encryption.label).to eq "lbl"
      end

      it "creates an luks2 encryption device for given block device" do
        expect(blk_device).to receive(:create_encryption)
          .with(anything, Y2Storage::EncryptionType::LUKS2)
          .and_call_original

        process.create_device(blk_device, dm_name, authentication)
      end

      it "does not set any specific encryption option" do
        encryption = subject.create_device(blk_device, dm_name, authentication)

        expect(encryption.crypt_options).to be_empty
      end

      it "does not set any specific open option" do
        encryption = subject.create_device(blk_device, dm_name, authentication)

        expect(encryption.open_options).to be_empty
      end
    end
  end

  describe "#encryption_type" do
    it "returns LUKS2 encryption" do
      encryption_type = subject.encryption_type()

      expect(encryption_type).to eq Y2Storage::EncryptionType::LUKS2
    end
  end
end
