#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016-2023] SUSE LLC
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

require "y2storage"

# These tests were originally for SpaceMaker but were moved here when some responsibilities
# were reorganized. Some may look a bit odd now, but that's better than removing the tests.
describe Y2Storage::Proposal::DevicegraphGenerator do
  include_context "yast2-storage-ng test setup"

  # Partition from fake_devicegraph, fetched by name
  def probed_partition(name)
    fake_devicegraph.partitions.detect { |p| p.name == name }
  end

  # Block device for the filesystem mounted at the given location
  def blk_dev(graph, mount_path)
    graph.filesystems.find { |f| f.mount_path == mount_path }.blk_devices.first
  end

  before do
    fake_scenario(scenario)
    allow(analyzer).to receive(:windows_partitions).and_return windows_partitions
  end

  let(:settings) do
    settings = Y2Storage::ProposalSettings.new_for_current_product
    settings.candidate_devices = ["/dev/sda"]
    settings.root_device = "/dev/sda"
    settings.resize_windows = resize_windows
    settings.windows_delete_mode = delete_windows
    settings.linux_delete_mode = delete_linux
    settings.other_delete_mode = delete_other
    settings
  end
  # Default values for settings
  let(:resize_windows) { true }
  let(:delete_windows) { :ondemand }
  let(:delete_linux) { :ondemand }
  let(:delete_other) { :ondemand }

  let(:analyzer) { Y2Storage::DiskAnalyzer.new(fake_devicegraph) }
  let(:windows_partitions) { [] }

  subject(:generator) { described_class.new(settings, analyzer) }

  describe "#devicegraph" do
    using Y2Storage::Refinements::SizeCasts

    let(:volumes) { [vol1] }
    let(:lvm_helper) { Y2Storage::Proposal::LvmHelper.new([], settings) }

    context "when forced to delete partitions" do
      let(:scenario) { "multi-linux-pc" }

      it "doesn't delete partitions marked to be reused" do
        sda6 = probed_partition("/dev/sda6")
        vol1 = planned_partition(mount_point: "/1", type: :ext4, min: 100.GiB)
        vol2 = planned_partition(mount_point: "/2", reuse_sid: sda6.sid)
        volumes = [vol1, vol2]

        result = generator.devicegraph(volumes, fake_devicegraph)
        expect(result.partitions.map(&:sid)).to include sda6.sid
      end
    end

    context "when some volumes must be reused" do
      let(:scenario) { "multi-linux-pc" }
      let(:probed_sda6) { probed_partition("/dev/sda6") }
      let(:probed_sda2) { probed_partition("/dev/sda2") }
      let(:volumes) do
        [
          planned_vol(mount_point: "/1", type: :ext4, min: 60.GiB),
          planned_vol(mount_point: "/2", type: :ext4, min: 300.GiB),
          planned_vol(mount_point: "/3", reuse_sid: probed_sda6.sid),
          planned_vol(mount_point: "/4", reuse_sid: probed_sda2.sid)
        ]
      end

      it "uses existing partitions for reused volumes and new partitions for the others" do
        result = generator.devicegraph(volumes, fake_devicegraph)
        expect(blk_dev(result, "/1").exists_in_probed?).to eq false
        expect(blk_dev(result, "/2").exists_in_probed?).to eq false
        expect(blk_dev(result, "/3").exists_in_probed?).to eq true
        expect(blk_dev(result, "/4").exists_in_probed?).to eq true
      end

      it "only makes space for non reused volumes" do
        devgraph = generator.devicegraph(volumes, fake_devicegraph)
        expect(devgraph.free_spaces).to be_empty
      end
    end

    context "when a LVM VG is going to be reused" do
      let(:scenario) { "lvm-two-vgs" }
      let(:windows_partitions) { [partition_double("/dev/sda1")] }
      let(:resize_info) do
        instance_double("Y2Storage::ResizeInfo", resize_ok?: true, min_size: 10.GiB, max_size: 800.GiB)
      end

      let(:lvm_helper) { Y2Storage::Proposal::LvmHelper.new([], settings) }

      before do
        # We are reusing vg1
        settings.lvm = true
        allow(Y2Storage::Proposal::LvmHelper).to receive(:new).and_return(lvm_helper)
        expect(lvm_helper).to receive(:partitions_in_vg).and_return ["/dev/sda5", "/dev/sda9"]

        # At some point, we can try to resize Windows
        allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
          .and_return(resize_info)
      end

      it "does not delete partitions belonging to the reused VG" do
        volumes = [planned_vol(mount_point: "/1", type: :ext4, min: 2.GiB)]
        result = generator.devicegraph(volumes, fake_devicegraph)
        partitions = result.partitions

        # sda5 and sda9 belong to vg1
        expect(partitions.map(&:sid)).to include probed_partition("/dev/sda9").sid
        expect(partitions.map(&:sid)).to include probed_partition("/dev/sda5").sid
        # sda8 is deleted instead of sda9
        expect(partitions.map(&:sid)).to_not include probed_partition("/dev/sda8").sid
      end

      it "does nothing special about partitions from other VGs" do
        volumes = [planned_vol(mount_point: "/1", type: :ext4, min: 6.GiB)]
        result = generator.devicegraph(volumes, fake_devicegraph)
        partitions = result.partitions

        # sda7 belongs to vg0
        expect(partitions.map(&:sid)).to_not include probed_partition("/dev/sda7").sid
      end
    end
  end
end
