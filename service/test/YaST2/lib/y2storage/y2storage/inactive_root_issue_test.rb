#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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
require "y2storage/inactive_root_issue"

describe Y2Storage::InactiveRootIssue do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(filesystem) }

  let(:scenario) { "mixed_disks" }
  let(:devicegraph) { devicegraph_from(scenario) }
  let(:filesystem) { device.filesystem }
  let(:device) { devicegraph.find_by_name("/dev/sda2") }

  describe "#message" do
    it "warns about inactive root" do
      expect(subject.message).to match("root filesystem looks like not currently mounted")
    end
  end

  describe "#description" do
    context "when filesystem is btrfs" do
      let(:device) { devicegraph.find_by_name("/dev/sdb2") }

      it "includes rollback tip" do
        expect(subject.description).to match("executed a snapshot rollback")
      end
    end

    context "when filesystem is not btrfs" do
      it "returns nil" do
        expect(subject.description).to be_nil
      end
    end
  end

  describe "#details" do
    it "returns nil" do
      expect(subject.details).to be_nil
    end
  end
end
