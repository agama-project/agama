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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage/autoinst_issues/shrinked_planned_devices"

describe Y2Storage::AutoinstIssues::ShrinkedPlannedDevices do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:issue) { described_class.new(device_shrinkages) }

  let(:planned_unmounted) { instance_double(Y2Storage::Planned::Partition, min_size: 275.GiB) }
  let(:planned_root) { instance_double(Y2Storage::Planned::Partition, min_size: 25.GiB) }

  let(:real_unmounted) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sda1") }
  let(:real_root) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sda3") }

  let(:device_shrinkages) do
    [
      Y2Storage::Proposal::DeviceShrinkage.new(planned_root, real_root),
      Y2Storage::Proposal::DeviceShrinkage.new(planned_unmounted, real_unmounted)
    ]
  end

  before do
    fake_scenario("windows-linux-free-pc")
    real_root.filesystem.mount_path = "/"
  end

  describe "#message" do
    it "returns a description of the issue" do
      expect(issue.message)
        .to include("Some additional space (30.00 GiB) was required for new partitions")
    end

    it "includes details about each device" do
      expect(issue.message).to include "/ to 20.00 GiB (-5.00 GiB)"
    end

    it "includes details about each device even if it is not mounted" do
      expect(issue.message).to include "/dev/sda1 to 250.00 GiB (-25.00 GiB)"
    end
  end

  describe "#severity" do
    it "returns :warn" do
      expect(issue.severity).to eq(:warn)
    end
  end

  describe "#diff" do
    it "returns the size difference" do
      expect(issue.diff).to eq(30.GiB)
    end
  end
end
