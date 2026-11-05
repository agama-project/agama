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

describe Y2Storage::BcacheCset do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "bcache1.xml" }
  let(:bcache_name) { "/dev/bcache0" }

  subject(:bcache_cset) { Y2Storage::Bcache.find_by_name(fake_devicegraph, bcache_name).bcache_cset }

  describe "#blk_devices" do
    it "returns list of BlkDevices" do
      subject.blk_devices.each do |dev|
        expect(dev).to be_a Y2Storage::BlkDevice
      end
    end

    it "returns caching device for bcache" do
      expect(subject.blk_devices.map(&:basename)).to eq(["vdb"])
    end
  end

  describe "#uuid" do
    it "returns uui string" do
      expect(subject.uuid).to eq "acb129b8-b55e-45bb-aa99-41a6f0a0ef07"
    end
  end

  describe "#display_name" do
    it "returns user friendly name" do
      expect(subject.display_name).to eq "Cache set (bcache0, bcache1, bcache2)"
    end
  end

  describe ".all" do
    it "returns a list of Y2Storage::BcacheCset objects" do
      bcaches = Y2Storage::BcacheCset.all(fake_devicegraph)
      expect(bcaches).to be_an Array
      expect(bcaches).to all(be_a(Y2Storage::BcacheCset))
    end

    it "includes all bcaches in the devicegraph and nothing else" do
      bcaches = Y2Storage::BcacheCset.all(fake_devicegraph)
      expect(bcaches).to eq [subject]
    end
  end
end
