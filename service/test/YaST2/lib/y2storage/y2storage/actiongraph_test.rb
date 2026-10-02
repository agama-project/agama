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

describe Y2Storage::Actiongraph do
  include_context "yast2-storage-ng test setup"

  describe "#used_features" do
    let(:scenario) { "mixed_disks" }
    let(:staging) { Y2Storage::StorageManager.instance.staging }

    before do
      fake_scenario(scenario)
      ntfs = staging.filesystems.find { |fs| fs.type.is?(:ntfs) }
      ntfs.mount_path = "/mnt"
    end

    it "returns the expected set of storage features" do
      features = staging.actiongraph.used_features
      expect(features).to be_a Y2Storage::StorageFeaturesList
      expect(features.size).to eq 1
      expect(features.first.id).to eq :UF_NTFS
    end
  end
end
