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

require "y2storage/planned"

describe Y2Storage::Planned::Md do
  include_context "yast2-storage-ng test setup"

  subject(:planned_md) { described_class.new }

  describe "#add_devices" do
    let(:sda1) { double("Y2Storage::Partition", name: "/dev/sda1") }
    let(:sda2) { double("Y2Storage::Partition", name: "/dev/sda2") }
    let(:sdb1) { double("Y2Storage::Partition", name: "/dev/sdb1") }
    let(:sdb2) { double("Y2Storage::Partition", name: "/dev/sdb2") }
    let(:devices) { [sdb1, sdb2, sda2, sda1] }
    let(:real_md) { double("Y2Storage::Md") }

    it "calls Y2Storage::Md#add_device for all the devices" do
      expect(real_md).to receive(:sorted_devices=).once

      planned_md.add_devices(real_md, devices)
    end

    context "if #devices_order is not set" do
      it "adds the devices in name's alphabetical order" do
        expect(real_md).to receive(:sorted_devices=).with([sda1, sda2, sdb1, sdb2]).once

        planned_md.add_devices(real_md, devices)
      end
    end

    context "if #devices_order is set" do
      before do
        planned_md.devices_order = ["/dev/sdb2", "/dev/sda1", "/dev/sda2", "/dev/sdb1"]
      end

      it "adds the devices in the specified order" do
        expect(real_md).to receive(:sorted_devices=).with([sdb2, sda1, sda2, sdb1]).once

        planned_md.add_devices(real_md, devices)
      end

      context "if #devices_order contains devices that are not in the list" do
        before do
          planned_md.devices_order = ["/dev/sdb2", "/dev/sda1", "/dev/sda3", "/dev/sda2", "/dev/sdb1"]
        end

        it "adds the devices in the specified order" do
          expect(real_md).to receive(:sorted_devices=).with([sdb2, sda1, sda2, sdb1]).once

          planned_md.add_devices(real_md, devices)
        end

        it "does not try to add additional devices" do
          expect(real_md).to receive(:sorted_devices=).once

          planned_md.add_devices(real_md, devices)
        end
      end

      context "if some of the devices are not in #devices_order" do
        before { planned_md.devices_order = ["/dev/sdb2", "/dev/sda2"] }

        it "adds all the devices" do
          expect(real_md).to receive(:sorted_devices=).once

          planned_md.add_devices(real_md, devices)
        end

        it "adds first the sorted devices and then the rest (alphabetically)" do
          expect(real_md).to receive(:sorted_devices=).with([sdb2, sda2, sda1, sdb1]).once

          planned_md.add_devices(real_md, devices)
        end
      end
    end
  end

  # Only basic cases are tested here. More exhaustive tests can be found in tests
  # for Y2Storage::MatchVolumeSpec
  describe "match_volume?" do
    let(:volume) { Y2Storage::VolumeSpecification.new({}) }

    before do
      planned_md.mount_point = mount_point
      planned_md.filesystem_type = filesystem_type

      volume.mount_point = volume_mount_point
      volume.partition_id = volume_partition_id
      volume.fs_types = volume_fs_types
      volume.min_size = volume_min_size
    end

    let(:volume_mount_point) { "/boot" }
    let(:volume_partition_id) { nil }
    let(:volume_fs_types) { [Y2Storage::Filesystems::Type::EXT2] }
    let(:volume_min_size) { Y2Storage::DiskSize.zero }

    context "when the planned MD has the same values" do
      let(:mount_point) { volume_mount_point }
      let(:filesystem_type) { volume_fs_types.first }

      context "and the size is excluded for matching" do
        let(:exclude) { :size }

        it "returns true" do
          expect(planned_md.match_volume?(volume, exclude: exclude)).to eq(true)
        end

        context "but the volume requires a specific partition id" do
          let(:volume_partition_id) { Y2Storage::PartitionId::ESP }

          it "returns false" do
            expect(planned_md.match_volume?(volume, exclude: exclude)).to eq(false)
          end
        end
      end
    end

    context "when the planned MD does not have the same values" do
      let(:mount_point) { "/boot/efi" }
      let(:filesystem_type) { Y2Storage::Filesystems::Type::VFAT }

      it "returns false" do
        expect(planned_md.match_volume?(volume)).to eq(false)
      end
    end
  end
end
