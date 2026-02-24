# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../storage_helpers"
require "agama/storage/config_conversions/from_json"
require "agama/storage/config_solvers/volume_groups_search"
require "agama/storage/system"
require "y2storage"

describe Agama::Storage::ConfigSolvers::VolumeGroupsSearch do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(storage_system) }

  let(:storage_system) { Agama::Storage::System.new }

  before do
    mock_storage(devicegraph: scenario)
  end

  describe "#solve" do
    let(:scenario) { "several_vgs.yaml" }

    let(:config_json) { { volumeGroups: volume_groups } }

    let(:config) do
      Agama::Storage::ConfigConversions::FromJSON
        .new(config_json)
        .convert
    end

    context "if a volume group config has a search for any device" do
      let(:volume_groups) do
        [
          { search: { max: 1 } },
          { search: { max: 1 } }
        ]
      end

      it "sets the first unassigned device to the volume group config" do
        subject.solve(config)
        expect(config.volume_groups.size).to eq(2)

        vg1, vg2 = config.volume_groups
        expect(vg1.search.solved?).to eq(true)
        expect(vg1.search.device.name).to eq("/dev/data")
        expect(vg2.search.solved?).to eq(true)
        expect(vg2.search.device.name).to eq("/dev/extra")
      end
    end

    context "if a volume group config contains a search without condition and without max" do
      let(:volume_groups) do
        [
          { search: {} }
        ]
      end

      it "expands the number of volume group configs to match all the existing VGs" do
        subject.solve(config)
        expect(config.volume_groups.size).to eq(3)

        vg1, vg2, vg3 = config.volume_groups
        expect(vg1.search.solved?).to eq(true)
        expect(vg1.search.device.name).to eq("/dev/data")
        expect(vg2.search.solved?).to eq(true)
        expect(vg2.search.device.name).to eq("/dev/extra")
        expect(vg3.search.solved?).to eq(true)
        expect(vg3.search.device.name).to eq("/dev/system")
      end

      context "but ordering by descending device name" do
        let(:volume_groups) do
          [
            { search: { sort: { name: "desc" } } }
          ]
        end

        it "expands the number of volume group configs to match all the existing VGs in order" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(3)

          vg1, vg2, vg3 = config.volume_groups
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device.name).to eq("/dev/system")
          expect(vg2.search.solved?).to eq(true)
          expect(vg2.search.device.name).to eq("/dev/extra")
          expect(vg3.search.solved?).to eq(true)
          expect(vg3.search.device.name).to eq("/dev/data")
        end
      end
    end

    context "if a volume group config contains a search without conditions but with a max" do
      let(:volume_groups) do
        [
          { search: { max: max } }
        ]
      end

      context "and the max is equal or smaller than the number of VGs" do
        let(:max) { 2 }

        it "expands the number of volume group configs to match the max" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(2)

          vg1, vg2 = config.volume_groups
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device.name).to eq("/dev/data")
          expect(vg2.search.solved?).to eq(true)
          expect(vg2.search.device.name).to eq("/dev/extra")
        end

        context "but ordering by descending device name" do
          let(:volume_groups) do
            [
              { search: { sort: { name: "desc" }, max: max } }
            ]
          end

          it "expands the number of volume group configs to match the max considering the order" do
            subject.solve(config)
            expect(config.volume_groups.size).to eq(2)

            vg1, vg2 = config.volume_groups
            expect(vg1.search.solved?).to eq(true)
            expect(vg1.search.device.name).to eq("/dev/system")
            expect(vg2.search.solved?).to eq(true)
            expect(vg2.search.device.name).to eq("/dev/extra")
          end
        end
      end

      context "and the max is bigger than the number of VGs" do
        let(:max) { 20 }

        it "expands the number of volume_group configs to match all the existing VGs" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(3)

          vg1, vg2, vg3 = config.volume_groups
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device.name).to eq("/dev/data")
          expect(vg2.search.solved?).to eq(true)
          expect(vg2.search.device.name).to eq("/dev/extra")
          expect(vg3.search.solved?).to eq(true)
          expect(vg3.search.device.name).to eq("/dev/system")
        end
      end
    end

    context "if a volume group config has a search with condition" do
      let(:volume_groups) do
        [
          { search: search }
        ]
      end

      context "and the device was already assigned" do
        let(:volume_groups) do
          [
            { search: { max: 1 } },
            { search: "/dev/data" }
          ]
        end

        it "does not set a device to the vg RAID config" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(2)

          _, vg2 = config.volume_groups
          expect(vg2.search.solved?).to eq(true)
          expect(vg2.search.device).to be_nil
        end
      end

      context "and there is other volume group config with the same device" do
        let(:volume_groups) do
          [
            { search: "/dev/data" },
            { search: "/dev/data" }
          ]
        end

        it "only sets the device to the first volume group config" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(2)

          vg1, vg2 = config.volume_groups
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device.name).to eq("/dev/data")
          expect(vg2.search.solved?).to eq(true)
          expect(vg2.search.device).to be_nil
        end
      end
    end

    context "if a volume group config has a search with a device name" do
      let(:volume_groups) do
        [
          { search: search }
        ]
      end

      context "and the device is found" do
        let(:search) { "/dev/extra" }

        it "sets the device to the volume group config" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(1)

          vg1 = config.volume_groups.first
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device.name).to eq("/dev/extra")
        end
      end

      context "and the device is not found" do
        let(:search) { "/dev/missing" }

        # Speed-up fallback search (and make sure it fails)
        before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

        it "does not set a device to the vg RAID config" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(1)

          vg1 = config.volume_groups.first
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device).to be_nil
        end
      end
    end

    context "if a volume group config has a search with a size" do
      let(:volume_groups) do
        [
          {
            search: {
              condition: { size: size }
            }
          }
        ]
      end

      shared_examples "find device" do |device|
        it "sets the device to the volume_group config" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(1)

          vg1 = config.volume_groups.first
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device.name).to eq(device)
        end
      end

      shared_examples "do not find device" do
        it "does not set a device to the volume group config" do
          subject.solve(config)
          expect(config.volume_groups.size).to eq(1)

          vg1 = config.volume_groups.first
          expect(vg1.search.solved?).to eq(true)
          expect(vg1.search.device).to be_nil
        end
      end

      context "and the operator is :equal" do
        let(:size) { { equal: value } }

        context "and there is a VG with equal size" do
          let(:value) { storage_system.devicegraph.find_by_name("/dev/extra").size }
          include_examples "find device", "/dev/extra"
        end

        context "and there is no VG with equal size" do
          let(:size) { "20 GiB" }
          include_examples "do not find device"
        end
      end

      context "and the operator is :greater" do
        let(:size) { { greater: value } }

        context "and there is a VG with greater size" do
          let(:value) { "40 GiB" }
          include_examples "find device", "/dev/data"
        end

        context "and there is no VG with greater size" do
          let(:value) { "200 GiB" }
          include_examples "do not find device"
        end
      end

      context "and the operator is :less" do
        let(:size) { { less: value } }

        context "and there is a vg RAID with less size" do
          let(:value) { "6 GiB" }
          include_examples "find device", "/dev/extra"
        end

        context "and there is no vg RAID with less size" do
          let(:value) { "4 GiB" }
          include_examples "do not find device"
        end
      end
    end

    context "if a volume group config has logical volumes with search" do
      let(:volume_groups) do
        [
          {
            search:         "/dev/system",
            logicalVolumes: [{ search: {} }]
          }
        ]
      end

      it "solves the search of the logical volumes" do
        subject.solve(config)
        logical_volumes = config.volume_groups.first.logical_volumes
        expect(logical_volumes.size).to eq(2)

        lv1, lv2 = logical_volumes
        expect(lv1.search.solved?).to eq(true)
        expect(lv1.search.device.name).to eq("/dev/system/root")
        expect(lv2.search.solved?).to eq(true)
        expect(lv2.search.device.name).to eq("/dev/system/swap")
      end
    end
  end
end
