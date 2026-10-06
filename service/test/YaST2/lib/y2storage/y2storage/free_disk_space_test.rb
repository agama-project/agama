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

require "y2storage"

describe Y2Storage::FreeDiskSpace do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  subject { described_class.new(device, region) }

  let(:device) { fake_devicegraph.find_by_name(device_name) }

  describe "#reused_partition?" do
    context "if the region belongs to an unused slot" do
      let(:scenario) { "mixed_disks" }

      let(:device_name) { "/dev/sda" }

      let(:region) { device.partition_table.unused_partition_slots.first.region }

      it "returns false" do
        expect(subject.reused_partition?).to eq(false)
      end
    end

    context "if the region belongs to a partition" do
      let(:scenario) { "several-dasds" }

      let(:device_name) { "/dev/dasda" }

      let(:region) { device.partition_table.partition.region }

      it "returns true" do
        expect(subject.reused_partition?).to eq(true)
      end
    end
  end
end
