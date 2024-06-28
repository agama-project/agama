# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require_relative "../../test_helper"
require_relative "storage_helpers"
require "agama/storage/action"
require "y2storage"

describe Agama::Storage::Action do
  include Agama::RSpec::StorageHelpers

  let(:system_graph) { Y2Storage::StorageManager.instance.probed }
  let(:staging_graph) { Y2Storage::StorageManager.instance.staging }

  before do
    mock_storage(devicegraph: "staging-plain-partitions.yaml")

    # Delete home subvolume
    sda2 = staging_graph.find_by_name("/dev/sda2")
    sda2.filesystem.delete_btrfs_subvolume("home")

    # Resize sda2
    sda2.resize(Y2Storage::DiskSize.GiB(30))
  end

  let(:sda2_action) do
    action = staging_graph
      .actiongraph
      .compound_actions
      .find { |a| a.target_device.is?(:partition) && a.target_device.name == "/dev/sda2" }

    described_class.new(action, system_graph)
  end

  let(:subvol_action) do
    action = staging_graph
      .actiongraph
      .compound_actions
      .find { |a| a.target_device.is?(:btrfs_subvolume) }

    described_class.new(action, system_graph)
  end

  describe "#device_sid" do
    it "returns the SID of the affected device" do
      sda2 = system_graph.find_by_name("/dev/sda2")
      expect(sda2_action.device_sid).to eq(sda2.sid)

      home_subvol = sda2
        .filesystem
        .btrfs_subvolumes
        .find { |s| s.path == "home" }

      expect(subvol_action.device_sid).to eq(home_subvol.sid)
    end
  end

  describe "#text" do
    it "returns the description of the action" do
      expect(sda2_action.text).to match(/Shrink.*sda2/)
      expect(subvol_action.text).to match(/Delete.*home/)
    end
  end

  describe "#on_btrfs_subvolume?" do
    it "returns true if the affected device is a Btrfs subvolume" do
      expect(subvol_action.on_btrfs_subvolume?).to eq(true)
    end

    it "returns false if the affected device is not a Btrfs subvolume" do
      expect(sda2_action.on_btrfs_subvolume?).to eq(false)
    end
  end

  describe "#delete?" do
    it "returns true if the affected device is deleted" do
      expect(subvol_action.delete?).to eq(true)
    end

    it "returns false if the affected device is not deleted" do
      expect(sda2_action.delete?).to eq(false)
    end
  end

  describe "#resize?" do
    it "returns true if the affected device is resized" do
      expect(sda2_action.resize?).to eq(true)
    end

    it "returns false if the affected device is not resized" do
      expect(subvol_action.resize?).to eq(false)
    end
  end
end
