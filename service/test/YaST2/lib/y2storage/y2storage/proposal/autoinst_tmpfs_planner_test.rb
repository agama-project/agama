#!/usr/bin/env rspec
# frozen_string_literal: true

#
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
require_relative "../../support/autoinst_devices_planner_btrfs"
require "y2storage/proposal/autoinst_tmpfs_planner"
require "y2storage/autoinst_issues"
require "y2storage/autoinst_profile/drive_section"

describe Y2Storage::Proposal::AutoinstTmpfsPlanner do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:planner) { described_class.new(fake_devicegraph, issues_list) }
  let(:scenario) { "empty_disks" }
  let(:issues_list) { ::Installation::AutoinstIssues::List.new }

  before do
    fake_scenario(scenario)
  end

  describe "#planned_devices" do
    let(:drive) do
      Y2Storage::AutoinstProfile::DriveSection.new_from_hashes(
        "partitions" => [tmpfs0, tmpfs1]
      )
    end

    let(:tmpfs0) { { "mount" => "/srv", "fstopt" => "512M" } }
    let(:tmpfs1) { { "mount" => "/var/tmp", "fstopt" => "size=3G" } }

    it "returns a planned tmpfs device for each partition section" do
      planned = planner.planned_devices(drive)
      expect(planned).to contain_exactly(
        an_object_having_attributes(mount_point: "/srv"),
        an_object_having_attributes(mount_point: "/var/tmp")
      )
    end

    context "when the mount point is missing" do
      let(:tmpfs0) { { "fstopt" => "512M" } }

      it "registers and issue" do
        planner.planned_devices(drive)
        issue = issues_list.find { |i| i.is_a?(Y2Storage::AutoinstIssues::MissingValue) }
        expect(issue).to_not be_nil
        expect(issue.attr).to eq(:mount)
      end
    end
  end
end
