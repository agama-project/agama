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
require "y2storage"

describe Y2Storage::Proposal::PartitionTableCreator do
  include_context "yast2-storage-ng test setup"

  subject(:creator) { described_class.new }

  let(:scenario) { "windows-linux-free-pc" }
  let(:device) { Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/sda") }
  let(:ptable_type) { Y2Storage::PartitionTables::Type::GPT }

  before do
    fake_scenario(scenario)
  end

  context "if no partition table exists" do
    before do
      device.remove_descendants
    end

    it "creates one of the given type" do
      creator.create_or_update(device, ptable_type)
      expect(device.partition_table.type).to eq(ptable_type)
    end
  end

  context "if there is no planned partition type" do
    before do
      allow(device).to receive(:preferred_ptable_type)
        .and_return(Y2Storage::PartitionTables::Type::MSDOS)
    end

    it "creates one of the preferred type" do
      creator.create_or_update(device, nil)
      expect(device.partition_table.type).to eq(device.preferred_ptable_type)
    end
  end

  context "if there is any partition" do
    it "does not modify the partition table" do
      creator.create_or_update(device, ptable_type)
      expect(device.partition_table.type).to eq(Y2Storage::PartitionTables::Type::MSDOS)
    end
  end
end
