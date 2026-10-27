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

require "y2storage/autoinst_issues"

describe Y2Storage::AutoinstIssues::CouldNotCreateBoot do
  include_context "yast2-storage-ng test setup"

  subject(:issue) { described_class.new(devices) }

  describe "#message" do
    context "when one of the missing partitions is the BIOS boot" do
      let(:devices) { [planned_partition(partition_id: Y2Storage::PartitionId::BIOS_BOOT)] }

      it "returns a specific error message" do
        expect(issue.message).to include("cannot add a BIOS Boot partition")
      end
    end

    context "when none of the missing partitions is BIOS boot" do
      let(:devices) do
        [
          planned_partition(partition_id: Y2Storage::PartitionId::PREP),
          planned_partition(mount_point: "/boot")
        ]
      end

      it "returns a generic description of the issue" do
        expect(issue.message).to include("Not possible to add the partitions")
      end
    end

    context "when no missing partitions are specified" do
      let(:devices) { [] }

      it "returns a generic description of the issue" do
        expect(issue.message).to include("Not possible to add the partitions")
      end
    end
  end

  describe "#severity" do
    let(:devices) { [] }

    it "returns :warn" do
      expect(issue.severity).to eq(:warn)
    end
  end
end
