#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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

describe Y2Storage::PartitionTables::Msdos do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario("empty_hard_disk_50GiB")
  end

  let(:disk) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sda") }
  let(:partition_table_type) { Y2Storage::PartitionTables::Type.find(:msdos) }

  subject { disk.create_partition_table(partition_table_type) }

  describe "#partition_id_for" do
    it "returns the same partition id" do
      swap = Y2Storage::PartitionId::SWAP
      expect(subject.partition_id_for(swap)).to eq swap
    end
  end

  describe "#partition_id_supported?" do
    it "ms-dos can have a LINUX partition" do
      expect(subject.partition_id_supported?(Y2Storage::PartitionId::LINUX)).to eq true
    end

    it "ms-dos can NOT have a WINDOWS_BASIC_DATA partition" do
      expect(subject.partition_id_supported?(Y2Storage::PartitionId::WINDOWS_BASIC_DATA)).to eq false
    end

    it "ms-dos can have a DOS32 partition" do
      expect(subject.partition_id_supported?(Y2Storage::PartitionId::DOS32)).to eq true
    end

    it "ms-dos can have an UNKNOWN partition" do
      expect(subject.partition_id_supported?(Y2Storage::PartitionId::UNKNOWN)).to eq true
    end

    it "ms-dos can NOT have partition id 0" do
      expect(subject.partition_id_supported?(0)).to eq false
    end
  end

  describe "#supported_partition_ids" do
    it "list includes the LINUX id" do
      expect(subject.supported_partition_ids).to include Y2Storage::PartitionId::LINUX
    end

    it "list includes the DOS32 id" do
      expect(subject.supported_partition_ids).to include Y2Storage::PartitionId::DOS32
    end

    it "list does not include the UNKNOWN id" do
      expect(subject.supported_partition_ids).not_to include Y2Storage::PartitionId::UNKNOWN
    end
  end
end
