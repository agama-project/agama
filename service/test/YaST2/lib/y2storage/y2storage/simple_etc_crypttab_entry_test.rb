#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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
require "y2storage/simple_etc_crypttab_entry"

describe Y2Storage::SimpleEtcCrypttabEntry do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { crypttab_entry(name, device, password, crypt_options) }

  let(:name) { "cr_device" }

  let(:password) { "P4ssW0rd" }

  let(:crypt_options) { [] }

  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  let(:scenario) { "encrypted_partition.xml" }

  describe "#find_device" do
    # Mock the system lookup performed as last resort to find a device
    before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

    context "when the crypttab device field contains a LUKS UUID (UUID= format)" do
      context "and a LUKS exists with such UUID" do
        let(:device) { "UUID=ccd40fe6-48df-491e-b862-02e5941e5d13" }

        it "returns the underlying device" do
          expect(subject.find_device(devicegraph).name).to eq("/dev/sda1")
        end
      end

      context "and a LUKS with such UUID does not exist" do
        let(:device) { "UUID=does-not-exist" }

        it "returns nil" do
          expect(subject.find_device(devicegraph)).to be_nil
        end
      end
    end

    context "when the crypttab device field contains a kernel path" do
      context "and the device exists" do
        let(:device) { "/dev/sda2" }

        it "returns the device" do
          expect(subject.find_device(devicegraph).name).to eq("/dev/sda2")
        end
      end

      context "and the device does not exist" do
        let(:device) { "/dev/sdb1" }

        it "returns nil" do
          expect(subject.find_device(devicegraph)).to be_nil
        end
      end
    end

    context "when the crypttab device field contains an udev path" do
      context "and the device exists" do
        let(:device) { "/dev/disk/by-id/ata-VBOX_HARDDISK_VB777f5d67-56603f01-part2" }

        it "returns the device" do
          expect(subject.find_device(devicegraph).name).to eq("/dev/sda2")
        end
      end

      context "and the device does not exist" do
        let(:device) { "/dev/disk/by-id/does-not-exist" }

        it "returns nil" do
          expect(subject.find_device(devicegraph)).to be_nil
        end
      end
    end
  end
end
