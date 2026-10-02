#!/usr/bin/env rspec
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage"

describe Y2Storage::BtrfsQgroup do
  include_context "yast2-storage-ng test setup"

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "btrfs_simple_quotas.xml" }
  let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

  let(:dev_name) { "/dev/vda2" }
  let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name) }
  let(:filesystem) { blk_device.blk_filesystem }
  let(:qgroups) { filesystem.btrfs_qgroups }
  let(:subvolumes) { filesystem.btrfs_subvolumes }

  describe "id" do
    context "for the qgroup associated to a subvolume" do
      let(:subvolume) { subvolumes.find(&:btrfs_qgroup) }
      subject(:qgroup) { subvolume.btrfs_qgroup }

      it "returns an array with level 0 and the id of the subvolume" do
        expect(qgroup.id).to eq [0, subvolume.id]
      end
    end

    context "for a qgroup not directly associated to a subvolume" do
      let(:subvol_qgroups) { subvolumes.map(&:btrfs_qgroup).compact }
      subject(:qgroup) { qgroups.find { |g| !subvol_qgroups.include?(g) } }

      it "returns an array with the level and the id of the qgroup" do
        expect(qgroup.id).to eq [1, 100]
      end
    end
  end

  describe "is?" do
    subject(:qgroup) { subvolumes.first.btrfs_qgroup }

    it "returns true for :btrfs_qgroup" do
      expect(qgroup.is?(:btrfs_qgroup)).to eq true
    end

    it "returns false for :btrfs or any other argument" do
      expect(qgroup.is?(:btrfs)).to eq false
    end
  end
end
