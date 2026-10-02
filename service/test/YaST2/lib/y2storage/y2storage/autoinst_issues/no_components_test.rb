# frozen_string_literal: true

# Copyright (c) [2020] SUSE LLC
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
require "y2storage/autoinst_issues"

describe Y2Storage::AutoinstIssues::NoComponents do
  include_context "yast2-storage-ng test setup"

  subject(:issue) { described_class.new(device) }

  let(:device) { planned_vg(volume_group_name: "vg0") }

  describe "#message" do
    context "when the device is a VG" do
      let(:device) { planned_vg(volume_group_name: "vg0") }

      it "returns a description of the issue" do
        expect(issue.message)
          .to include("Could not find a suitable physical volume for volume group 'vg0'")
      end
    end

    context "when the device is a RAID" do
      let(:device) { planned_md(name: "/dev/md0") }

      it "returns a description of the issue" do
        expect(issue.message).to include("Could not find a suitable member for RAID '/dev/md0'")
      end
    end

    context "when the device is a Bcache" do
      let(:device) { planned_bcache(name: "/dev/bcache0") }

      it "returns a description of the issue" do
        expect(issue.message)
          .to include("Could not find a backing device for Bcache '/dev/bcache0'")
      end
    end

    context "when the device is a Btrfs multi-device" do
      let(:device) { planned_btrfs("btrfs_52") }

      it "returns a description of the issue" do
        expect(issue.message)
          .to include("Could not find a suitable device for Btrfs filesystem 'btrfs_52'")
      end
    end
  end

  describe "#severity" do
    it "returns :fatal" do
      expect(issue.severity).to eq(:fatal)
    end
  end
end
