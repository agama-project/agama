# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/storage/config_solvers/drives_search"
require "y2storage"

describe Agama::Storage::ConfigSolvers::DrivesSearch do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(devicegraph) }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  before do
    mock_storage(devicegraph: scenario)
  end

  describe "#solve" do
    let(:scenario) { "disks.yaml" }

    let(:config_json) { { drives: drives } }

    let(:config) do
      Agama::Storage::ConfigConversions::FromJSON
        .new(config_json)
        .convert
    end

    context "if a drive config has the default search" do
      let(:drives) do
        [
          {},
          {},
          {}
        ]
      end

      it "sets the first unassigned device to the drive config" do
        subject.solve(config)
        expect(config.drives.size).to eq(3)

        drive1, drive2, drive3 = config.drives
        expect(drive1.search.solved?).to eq(true)
        expect(drive1.search.device.name).to eq("/dev/vda")
        expect(drive2.search.solved?).to eq(true)
        expect(drive2.search.device.name).to eq("/dev/vdb")
        expect(drive3.search.solved?).to eq(true)
        expect(drive3.search.device.name).to eq("/dev/vdc")
      end

      context "and any of the devices are excluded from the list of candidate devices" do
        before do
          allow_any_instance_of(Y2Storage::DiskAnalyzer)
            .to(receive(:candidate_disks))
            .and_return(
              [devicegraph.find_by_name("/dev/vdb"), devicegraph.find_by_name("/dev/vdc")]
            )
        end

        it "sets the first unassigned candidate device to the drive config" do
          subject.solve(config)
          expect(config.drives.size).to eq(3)

          drive1, drive2, drive3 = config.drives
          expect(drive1.search.solved?).to eq(true)
          expect(drive1.search.device.name).to eq("/dev/vdb")
          expect(drive2.search.solved?).to eq(true)
          expect(drive2.search.device.name).to eq("/dev/vdc")
          expect(drive3.search.solved?).to eq(true)
          expect(drive3.search.device).to be_nil
        end
      end

      context "and there is not unassigned device" do
        let(:drives) do
          [
            {},
            {},
            {},
            {}
          ]
        end

        it "does not set a device to the drive config" do
          subject.solve(config)
          expect(config.drives.size).to eq(4)

          drive4 = config.drives.last
          expect(drive4.search.solved?).to eq(true)
          expect(drive4.search.device).to be_nil
        end
      end
    end

    context "if a drive config contains a search without condition and without max" do
      let(:drives) do
        [
          { search: {} }
        ]
      end

      it "expands the number of drive configs to match all the existing disks" do
        subject.solve(config)
        expect(config.drives.size).to eq(3)

        drive1, drive2, drive3 = config.drives
        expect(drive1.search.solved?).to eq(true)
        expect(drive1.search.device.name).to eq("/dev/vda")
        expect(drive2.search.solved?).to eq(true)
        expect(drive2.search.device.name).to eq("/dev/vdb")
        expect(drive3.search.solved?).to eq(true)
        expect(drive3.search.device.name).to eq("/dev/vdc")
      end
    end

    context "if a drive config contains a search without conditions but with a max" do
      let(:drives) do
        [
          { search: { max: max } }
        ]
      end

      context "and the max is equal or smaller than the number of disks" do
        let(:max) { 2 }

        it "expands the number of drive configs to match the max" do
          subject.solve(config)
          expect(config.drives.size).to eq(2)

          drive1, drive2 = config.drives
          expect(drive1.search.solved?).to eq(true)
          expect(drive1.search.device.name).to eq("/dev/vda")
          expect(drive2.search.solved?).to eq(true)
          expect(drive2.search.device.name).to eq("/dev/vdb")
        end
      end

      context "and the max is bigger than the number of disks" do
        let(:max) { 20 }

        it "expands the number of drive configs to match all the existing disks" do
          subject.solve(config)
          expect(config.drives.size).to eq(3)

          drive1, drive2, drive3 = config.drives
          expect(drive1.search.solved?).to eq(true)
          expect(drive1.search.device.name).to eq("/dev/vda")
          expect(drive2.search.solved?).to eq(true)
          expect(drive2.search.device.name).to eq("/dev/vdb")
          expect(drive3.search.solved?).to eq(true)
          expect(drive3.search.device.name).to eq("/dev/vdc")
        end
      end
    end

    context "if a drive config has a search with a device name" do
      let(:drives) do
        [
          { search: search }
        ]
      end

      context "and the device is found" do
        let(:search) { "/dev/vdb" }

        it "sets the device to the drive config" do
          subject.solve(config)
          expect(config.drives.size).to eq(1)

          drive1 = config.drives.first
          expect(drive1.search.solved?).to eq(true)
          expect(drive1.search.device.name).to eq("/dev/vdb")
        end
      end

      context "and the device is not found" do
        let(:search) { "/dev/vdd" }

        # Speed-up fallback search (and make sure it fails)
        before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

        it "does not set a device to the drive config" do
          subject.solve(config)
          expect(config.drives.size).to eq(1)

          drive1 = config.drives.first
          expect(drive1.search.solved?).to eq(true)
          expect(drive1.search.device).to be_nil
        end
      end

      context "and the device was already assigned" do
        let(:drives) do
          [
            {},
            { search: "/dev/vda" }
          ]
        end

        it "does not set a device to the drive config" do
          subject.solve(config)
          expect(config.drives.size).to eq(2)

          _, drive2 = config.drives
          expect(drive2.search.solved?).to eq(true)
          expect(drive2.search.device).to be_nil
        end
      end

      context "and there is other drive config with the same device" do
        let(:drives) do
          [
            { search: "/dev/vdb" },
            { search: "/dev/vdb" }
          ]
        end

        it "only sets the device to the first drive config" do
          subject.solve(config)
          expect(config.drives.size).to eq(2)

          drive1, drive2 = config.drives
          expect(drive1.search.solved?).to eq(true)
          expect(drive1.search.device.name).to eq("/dev/vdb")
          expect(drive2.search.solved?).to eq(true)
          expect(drive2.search.device).to be_nil
        end
      end
    end

    context "if a drive config has partitions with search" do
      let(:drives) do
        [
          {
            partitions: [
              { search: {} }
            ]
          }
        ]
      end

      it "solves the search of the partitions" do
        subject.solve(config)
        partitions = config.drives.first.partitions
        expect(partitions.size).to eq(3)

        p1, p2, p3 = partitions
        expect(p1.search.solved?).to eq(true)
        expect(p1.search.device.name).to eq("/dev/vda1")
        expect(p2.search.solved?).to eq(true)
        expect(p2.search.device.name).to eq("/dev/vda2")
        expect(p3.search.solved?).to eq(true)
        expect(p3.search.device.name).to eq("/dev/vda3")
      end
    end
  end
end
