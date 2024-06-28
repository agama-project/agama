# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
require_relative "../storage_helpers"
require_relative "../../rspec/matchers/storage"
require "agama/storage/volume"
require "agama/storage/volume_conversions/from_y2storage"
require "y2storage"

describe Agama::Storage::VolumeConversions::FromY2Storage do
  include Agama::RSpec::StorageHelpers

  before { mock_storage }

  subject { described_class.new(volume) }

  let(:btrfs) { Y2Storage::Filesystems::Type::BTRFS }
  let(:ext4) { Y2Storage::Filesystems::Type::EXT4 }
  let(:xfs) { Y2Storage::Filesystems::Type::XFS }

  let(:volume) do
    Agama::Storage::Volume.new("/").tap do |volume|
      volume.location.target = :new_vg
      volume.location.device = "/dev/sda"
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

  describe "#convert" do
    it "generates a volume with the same values as the given volume" do
      result = subject.convert

      expect(result).to be_a(Agama::Storage::Volume)
      expect(result).to_not equal(volume)
      expect(result.location.target).to eq(:new_vg)
      expect(result.location.device).to eq("/dev/sda")
      expect(result.mount_path).to eq("/")
      expect(result.mount_options).to contain_exactly("defaults")
      expect(result.fs_type).to eq(btrfs)
      expect(result.auto_size).to eq(false)
      expect(result.min_size).to eq(Y2Storage::DiskSize.GiB(5))
      expect(result.max_size).to eq(Y2Storage::DiskSize.GiB(20))
      expect(result.btrfs.snapshots).to eq(true)
      expect(result.btrfs.subvolumes).to contain_exactly("@/home", "@/var")
      expect(result.btrfs.default_subvolume).to eq("@")
      expect(result.btrfs.read_only).to eq(true)
      expect(result.outline).to eq_outline(volume.outline)
    end

    context "sizes conversion" do
      before do
        allow(Y2Storage::StorageManager.instance).to receive(:proposal).and_return(proposal)
      end

      let(:proposal) do
        instance_double(Y2Storage::MinGuidedProposal, planned_devices: planned_devices)
      end

      let(:planned_devices) { [planned_volume] }

      context "if the volume is configured with auto size" do
        before do
          volume.auto_size = true
        end

        context "if there is a planned device for the volume" do
          let(:planned_volume) do
            Y2Storage::Planned::LvmLv.new("/").tap do |planned|
              planned.min = Y2Storage::DiskSize.GiB(10)
              planned.max = Y2Storage::DiskSize.GiB(40)
            end
          end

          it "sets the min and max sizes according to the planned device" do
            result = subject.convert

            expect(result.min_size).to eq(Y2Storage::DiskSize.GiB(10))
            expect(result.max_size).to eq(Y2Storage::DiskSize.GiB(40))
          end
        end

        context "if there is no planned device for the volume" do
          let(:planned_volume) do
            Y2Storage::Planned::LvmLv.new("/home").tap do |planned|
              planned.min = Y2Storage::DiskSize.GiB(10)
              planned.max = Y2Storage::DiskSize.GiB(40)
            end
          end

          it "keeps the sizes of the given volume" do
            result = subject.convert

            expect(result.min_size).to eq(Y2Storage::DiskSize.GiB(5))
            expect(result.max_size).to eq(Y2Storage::DiskSize.GiB(20))
          end
        end
      end

      context "if the volume is not configured with auto size" do
        before do
          volume.auto_size = false
        end

        let(:planned_volume) do
          Y2Storage::Planned::LvmLv.new("/").tap do |planned|
            planned.min = Y2Storage::DiskSize.GiB(10)
            planned.max = Y2Storage::DiskSize.GiB(40)
          end
        end

        it "keeps the sizes of the given volume" do
          result = subject.convert

          expect(result.min_size).to eq(Y2Storage::DiskSize.GiB(5))
          expect(result.max_size).to eq(Y2Storage::DiskSize.GiB(20))
        end
      end
    end
  end
end
