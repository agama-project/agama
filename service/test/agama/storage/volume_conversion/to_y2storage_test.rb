# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "agama/storage/volume_conversion/to_y2storage"
require "y2storage"

describe Agama::Storage::VolumeConversion::ToY2Storage do
  subject { described_class.new(volume) }

  describe "#convert" do
    let(:volume) do
      Agama::Storage::Volume.new("/").tap do |volume|
        volume.device = "/dev/sda"
        volume.separate_vg_name = "/dev/vg0"
        volume.mount_options = ["defaults"]
        volume.fs_type = btrfs
        volume.auto_size = false
        volume.min_size = Y2Storage::DiskSize.GiB(5)
        volume.max_size = Y2Storage::DiskSize.GiB(20)
        volume.btrfs.snapshots = true
        volume.btrfs.subvolumes = ["@/home", "@/var"]
        volume.btrfs.default_subvolume = "@"
        volume.btrfs.read_only = true
        volume.outline.required = true
        volume.outline.filesystems = [btrfs, ext4, xfs]
        volume.outline.adjust_by_ram = false
        volume.outline.snapshots_configurable = true
        volume.outline.snapshots_size = Y2Storage::DiskSize.GiB(10)
        volume.outline.snapshots_percentage = 20
      end
    end

    let(:btrfs) { Y2Storage::Filesystems::Type::BTRFS }
    let(:ext4) { Y2Storage::Filesystems::Type::EXT4 }
    let(:xfs) { Y2Storage::Filesystems::Type::XFS }

    it "converts the volume to a Y2Storage volume specification" do
      spec = subject.convert

      expect(spec).to be_a(Y2Storage::VolumeSpecification)
      expect(spec).to have_attributes(
        device:                  "/dev/sda",
        separate_vg_name:        "/dev/vg0",
        mount_point:             "/",
        mount_options:           "defaults",
        proposed?:               true,
        proposed_configurable?:  false,
        fs_types:                contain_exactly(btrfs, ext4, xfs),
        fs_type:                 btrfs,
        weight:                  100,
        adjust_by_ram?:          false,
        ignore_fallback_sizes:   true,
        ignore_snapshots_sizes:  true,
        min_size:                Y2Storage::DiskSize.GiB(5),
        max_size:                Y2Storage::DiskSize.GiB(20),
        max_size_lvm:            Y2Storage::DiskSize.GiB(20),
        snapshots:               true,
        snapshots_configurable?: true,
        snapshots_size:          Y2Storage::DiskSize.GiB(10),
        snapshots_percentage:    20,
        subvolumes:              ["@/home", "@/var"],
        btrfs_default_subvolume: "@",
        btrfs_read_only:         true
      )
    end

    context "when auto size is used" do
      before do
        volume.auto_size = true
        volume.outline.base_min_size = Y2Storage::DiskSize.GiB(10)
        volume.outline.base_max_size = Y2Storage::DiskSize.GiB(50)
      end

      it "sets the min and max spec sizes according to the volume outline" do
        spec = subject.convert

        expect(spec).to have_attributes(
          ignore_fallback_sizes:  false,
          ignore_snapshots_sizes: false,
          min_size:               Y2Storage::DiskSize.GiB(10),
          max_size:               Y2Storage::DiskSize.GiB(50),
          max_size_lvm:           Y2Storage::DiskSize.GiB(50)
        )
      end
    end
  end
end
