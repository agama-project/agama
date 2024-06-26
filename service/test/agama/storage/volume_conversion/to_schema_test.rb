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

require_relative "../../../test_helper"
require "agama/storage/volume_conversion/to_schema"
require "agama/storage/volume"
require "y2storage/filesystems/type"
require "y2storage/disk_size"

describe Agama::Storage::VolumeConversion::ToSchema do
  let(:default_volume) { Agama::Storage::Volume.new("/test") }

  let(:custom_volume1) do
    Agama::Storage::Volume.new("/test").tap do |volume|
      volume.fs_type = Y2Storage::Filesystems::Type::XFS
      volume.auto_size = true
    end
  end

  let(:custom_volume2) do
    Agama::Storage::Volume.new("/test").tap do |volume|
      volume.fs_type = Y2Storage::Filesystems::Type::BTRFS
      volume.btrfs.snapshots = true
      volume.mount_options = ["rw", "default"]
      volume.location.device = "/dev/sda"
      volume.location.target = :new_partition
      volume.min_size = Y2Storage::DiskSize.new(1024)
      volume.max_size = Y2Storage::DiskSize.new(2048)
    end
  end

  describe "#convert" do
    it "converts the volume to the proper hash according to the JSON schema" do
      # @todo Check whether the result matches the JSON schema.

      expect(described_class.new(default_volume).convert).to eq(
        mount:  {
          path:    "/test",
          options: []
        },
        size:   {
          min: 0
        },
        target: "default"
      )

      expect(described_class.new(custom_volume1).convert).to eq(
        mount:      {
          path:    "/test",
          options: []
        },
        filesystem: "xfs",
        size:       "auto",
        target:     "default"
      )

      expect(described_class.new(custom_volume2).convert).to eq(
        mount:      {
          path:    "/test",
          options: ["rw", "default"]
        },
        size:       {
          min: 1024,
          max: 2048
        },
        target:     {
          newPartition: "/dev/sda"
        },
        filesystem: {
          btrfs: {
            snapshots: true
          }
        }
      )
    end
  end
end
