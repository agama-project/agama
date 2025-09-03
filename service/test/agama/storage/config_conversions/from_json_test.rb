# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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

require_relative "../../../test_helper"
require "agama/storage/config"
require "agama/storage/config_conversions/from_json"

describe Agama::Storage::ConfigConversions::FromJSON do
  subject do
    described_class.new(config_json, default_paths: default_paths, mandatory_paths: mandatory_paths)
  end

  let(:default_paths) { ["/", "swap"] }

  let(:mandatory_paths) { ["/"] }

  describe "#convert" do
    let(:config_json) do
      {
        drives:       [
          {
            partitions: [
              { generate: "default" }
            ]
          }
        ],
        volumeGroups: [
          {
            name:           "vg0",
            logicalVolumes: [
              { filesystem: { path: "/home" } }
            ]
          }
        ]
      }
    end

    it "returns a storage config" do
      config = subject.convert
      boot = config.boot
      drive = config.drives.first
      volume_group = config.volume_groups.first

      expect(config).to be_a(Agama::Storage::Config)
      expect(boot.configure).to eq(true)
      expect(boot.device.default).to eq(true)
      expect(boot.device.device_alias).to be_nil
      expect(drive.partitions.map { |p| p.filesystem.path }).to contain_exactly("/", "swap")
      expect(volume_group.name).to eq("vg0")
      expect(volume_group.logical_volumes.map { |l| l.filesystem.path }).to contain_exactly("/home")
    end
  end
end
