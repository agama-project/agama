#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

require "y2storage"

describe Y2Storage::LvmPv do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { device.lvm_pv }

  let(:device) { fake_devicegraph.find_by_name(device_name) }

  describe "#plain_blk_device" do
    let(:scenario) { "complex-lvm-encrypt" }

    context "for a non encrypted PV" do
      let(:device_name) { "/dev/sde2" }

      it "returns the device directly hosting the PV" do
        expect(subject.plain_blk_device).to eq(subject.blk_device)
      end
    end

    context "for an encrypted PV" do
      let(:device_name) { "/dev/mapper/cr_sde1" }

      it "returns the plain version of the encrypted device" do
        expect(subject.plain_blk_device).to_not eq(subject.blk_device)
        expect(subject.plain_blk_device).to eq(subject.blk_device.plain_device)
      end
    end
  end

  describe "#unused?" do
    context "when the PV is associated to a VG" do
      let(:scenario) { "complex-lvm-encrypt" }

      let(:device_name) { "/dev/sde2" }

      it "returns false" do
        expect(subject.unused?).to eq(false)
      end
    end

    context "when the PV is not associated to a VG" do
      let(:scenario) { "unused_lvm_pvs.xml" }

      let(:device_name) { "/dev/sda2" }

      it "returns true" do
        expect(subject.unused?).to eq(true)
      end
    end
  end

  describe "#display_name" do
    context "when it is an unused PV" do
      let(:scenario) { "unused_lvm_pvs.xml" }

      let(:device_name) { "/dev/sda2" }

      it "returns a name representing the PV" do
        expect(subject.display_name).to match(/Unused LVM PV .*/)
      end
    end

    context "when it is not an unused PV" do
      let(:scenario) { "complex-lvm-encrypt" }

      let(:device_name) { "/dev/sde2" }

      it "returns nil" do
        expect(subject.display_name).to be_nil
      end
    end
  end
end
