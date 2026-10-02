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
require "y2storage/autoinst_issues/surplus_partitions"

describe Y2Storage::AutoinstIssues::SurplusPartitions do
  include_context "yast2-storage-ng test setup"

  subject(:issue) { described_class.new(section) }

  let(:section) do
    instance_double(Y2Storage::AutoinstProfile::DriveSection)
  end

  let(:device_name) { nil }

  describe "#message" do
    it "returns a message explaining the consequences" do
      expect(issue.message).to include "only the first will be considered"
    end
  end

  describe "#severity" do
    it "returns :warn" do
      expect(issue.severity).to eq(:warn)
    end
  end
end
