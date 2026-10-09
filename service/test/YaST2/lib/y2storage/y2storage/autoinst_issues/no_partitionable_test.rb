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

require "y2storage/autoinst_issues/no_partitionable"

describe Y2Storage::AutoinstIssues::NoPartitionable do
  include_context "yast2-storage-ng test setup"

  subject(:issue) { described_class.new(section) }

  let(:section) do
    instance_double(Y2Storage::AutoinstProfile::DriveSection, device: device_name, disklabel: "gpt")
  end

  let(:device_name) { nil }

  describe "#message" do
    context "when a device was not given" do
      let(:device_name) { nil }

      it "returns a general description of the issue" do
        expect(issue.message).to include "none of the remaining devices"
      end

      it "includes the value of the disklabel attribute" do
        expect(section).to receive(:disklabel).and_return "whatever"
        expect(issue.message).to include "whatever requested"
      end
    end

    context "when a device was given" do
      let(:device_name) { "/dev/xvda1" }

      it "returns a description including the device name" do
        expect(issue.message).to include "'/dev/xvda1' cannot contain a partition table"
      end

      it "includes the value of the disklabel attribute" do
        expect(section).to receive(:disklabel).and_return "whatever"
        expect(issue.message).to include "whatever requested"
      end
    end
  end

  describe "#severity" do
    it "returns :fatal" do
      expect(issue.severity).to eq(:fatal)
    end
  end
end
