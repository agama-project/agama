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

require_relative "../../../../../test_helper"
require "y2storage/device_description"

shared_examples "Device interface" do
  describe "Device D-Bus interface" do
    let(:scenario) { "partitioned_md.yml" }

    let(:device) { devicegraph.find_by_name("/dev/sda") }

    describe "#device_sid" do
      before do
        allow(device).to receive(:sid).and_return(123)
      end

      it "returns the SID of the device" do
        expect(subject.device_sid).to eq(123)
      end
    end

    describe "#device_name" do
      it "returns the name of the device" do
        expect(subject.device_name).to eq("/dev/sda")
      end
    end

    describe "#device_description" do
      before do
        allow(Y2Storage::DeviceDescription).to receive(:new)
          .with(device, include_encryption: true)
          .and_return(description)
      end

      let(:description) { instance_double(Y2Storage::DeviceDescription, to_s: "test") }

      it "returns the description of the device" do
        expect(subject.device_description).to eq("test")
      end
    end
  end
end
