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
require "y2storage/luks"

describe Y2Storage::Luks do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "encrypted_partition.xml" }

  subject { devicegraph.find_by_name(dev_name) }

  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  let(:dev_name) { "/dev/mapper/cr_sda1" }

  describe ".match_crypttab_spec?" do
    before do
      allow(subject).to receive(:uuid).and_return(luks_uuid)
    end

    let(:luks_uuid) { "111-222-3333" }

    it "returns true for the kernel name of the underlying device" do
      expect(subject.match_crypttab_spec?("/dev/sda1")).to eq(true)
    end

    it "returns true for any udev name of the underlying device" do
      subject.blk_device.udev_full_all.each do |name|
        expect(subject.match_crypttab_spec?(name)).to eq(true)
      end
    end

    it "returns true for the encryption device UUID when using UUID=" do
      expect(subject.match_crypttab_spec?("UUID=#{luks_uuid}")).to eq(true)
      expect(subject.match_crypttab_spec?("UUID='#{luks_uuid}'")).to eq(true)
      expect(subject.match_crypttab_spec?("UUID=\"#{luks_uuid}\"")).to eq(true)
    end

    it "returns false for the kernel name of the encryption device" do
      expect(subject.match_crypttab_spec?("/dev/mapper/cr_sda1")).to eq(false)
    end

    it "returns false for any udev name of the encryption device" do
      subject.udev_full_all.each do |name|
        expect(subject.match_crypttab_spec?(name)).to eq(false)
      end
    end

    it "returns false for other kernel name" do
      expect(subject.match_crypttab_spec?("/dev/sda2")).to eq(false)
    end

    it "returns false for other udev name" do
      expect(subject.match_crypttab_spec?("/dev/disks/by-uuid/111-2222-3333")).to eq(false)
    end

    it "returns false for other UUID when using UUID=" do
      expect(subject.match_crypttab_spec?("UUID=other-uuid")).to eq(false)
    end
  end
end
