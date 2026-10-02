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
require "y2storage/unsupported_bcache_issue"

describe Y2Storage::UnsupportedBcacheIssue do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new }

  before do
    devicegraph_from("bcache2.xml")
  end

  describe "#message" do
    it "returns a message for unsupported Bcache device" do
      expect(subject.message).to match("bcache is not supported")
    end
  end

  describe "#description" do
    it "warns about the risk of not working" do
      expect(subject.description).to match("may or may not work")
    end

    it "discourages to continue" do
      expect(subject.description).to match("Use at your own risk")
    end

    it "encourages to remove the bcache device before continuing" do
      expect(subject.description).to match("The safe way is to remove this bcache")
    end
  end

  describe "#details" do
    it "returns nil" do
      expect(subject.details).to be_nil
    end
  end
end
