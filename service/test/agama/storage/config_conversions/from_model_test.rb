# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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

require_relative "./from_model_conversions/context"
require "agama/storage/config"
require "agama/storage/config_conversions/from_model"

describe Agama::Storage::ConfigConversions::FromModel do
  include_context "from model conversions"

  subject do
    described_class.new(model_json, product_config: product_config)
  end

  describe "#convert" do
    let(:model_json) do
      {
        boot:         {
          configure: true
        },
        drives:       [
          { name: "/dev/vda" }
        ],
        mdRaids:      [
          { name: "/dev/md0" }
        ],
        volumeGroups: [
          { name: "/dev/vg0" }
        ]
      }
    end

    it "returns a storage config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Config)

      boot = config.boot
      expect(boot.configure?).to eq(true)
      expect(boot.device.default?).to eq(true)

      drives = config.drives
      expect(drives.size).to eq(1)

      drive = drives.first
      expect(drive.search.condition_name).to eq("/dev/vda")
      expect(drive.partitions).to be_empty

      md_raids = config.md_raids
      expect(md_raids.size).to eq(1)

      md_raid = md_raids.first
      expect(md_raid.search.condition_name).to eq("/dev/md0")
      expect(md_raid.partitions).to be_empty

      volume_groups = config.volume_groups
      expect(volume_groups.size).to eq(1)

      volume_group = volume_groups.first
      expect(volume_group.search.condition_name).to eq("/dev/vg0")
      expect(volume_group.logical_volumes).to be_empty
    end
  end
end
