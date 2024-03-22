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
        volume.location.device = "/dev/sda"
        volume.location.target = :new_vg
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
        separate_vg_name:        "vg-root",
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
        ignore_adjust_by_ram:    true,
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
          ignore_adjust_by_ram:   false,
          min_size:               Y2Storage::DiskSize.GiB(10),
          max_size:               Y2Storage::DiskSize.GiB(50),
          max_size_lvm:           Y2Storage::DiskSize.GiB(50)
        )
      end
    end

    context "when the default target is used" do
      before { volume.location.target = :default }

      it "sets both #device and #reuse_name to nil" do
        spec = subject.convert

        expect(spec.device).to be_nil
        expect(spec.reuse_name).to be_nil
      end
    end

    context "when the target is a new dedicated partition" do
      before { volume.location.target = :new_partition }

      it "sets #device to the expected disk name" do
        expect(subject.convert.device).to eq "/dev/sda"
      end

      it "sets #separate_vg_name and #reuse_name to nil" do
        spec = subject.convert

        expect(spec.reuse_name).to be_nil
        expect(spec.separate_vg_name).to be_nil
      end
    end

    context "when the target is a new dedicated volume group" do
      before { volume.location.target = :new_vg }

      context "when the mount point is /" do
        it "sets #device, #separate_vg_name and #reuse_name to the expected values" do
          spec = subject.convert

          expect(spec.device).to eq "/dev/sda"
          expect(spec.reuse_name).to be_nil
          expect(spec.separate_vg_name).to eq "vg-root"
        end
      end

      context "when the mount point is not the root one" do
        let(:volume) do
          Agama::Storage::Volume.new("/var/log").tap do |volume|
            volume.location.device = "/dev/sda"
          end
        end

        it "sets #device, #separate_vg_name and #reuse_name to the expected values" do
          spec = subject.convert

          expect(spec.device).to eq "/dev/sda"
          expect(spec.reuse_name).to be_nil
          expect(spec.separate_vg_name).to eq "vg-var_log"
        end
      end
    end

    context "when the target is an existing block device" do
      before { volume.location.target = :device }

      it "sets #reuse_name and #reformat to the proper values" do
        spec = subject.convert

        expect(spec.reuse_name).to eq "/dev/sda"
        expect(spec.reformat).to eq true
      end

      it "sets #device and #separate_vg_name to nil" do
        spec = subject.convert

        expect(spec.device).to be_nil
        expect(spec.separate_vg_name).to be_nil
      end
    end

    context "when the target is an existing file system" do
      before { volume.location.target = :filesystem }

      it "sets #reuse_name and #reformat to the proper values" do
        spec = subject.convert

        expect(spec.reuse_name).to eq "/dev/sda"
        expect(spec.reformat).to eq false
      end

      it "sets #device and #separate_vg_name to nil" do
        spec = subject.convert

        expect(spec.device).to be_nil
        expect(spec.separate_vg_name).to be_nil
      end
    end
  end
end
