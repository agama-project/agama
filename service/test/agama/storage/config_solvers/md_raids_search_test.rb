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
require "agama/storage/config_solvers/md_raids_search"
require "agama/storage/system"
require "y2storage"

describe Agama::Storage::ConfigSolvers::MdRaidsSearch do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(storage_system) }

  let(:storage_system) { Agama::Storage::System.new }

  before do
    mock_storage(devicegraph: scenario)
  end

  describe "#solve" do
    let(:scenario) { "md_raids.yaml" }

    let(:config_json) { { mdRaids: md_raids } }

    let(:config) do
      Agama::Storage::ConfigConversions::FromJSON
        .new(config_json)
        .convert
    end

    context "if a MD RAID config has a search for any device" do
      let(:md_raids) do
        [
          { search: { max: 1 } },
          { search: { max: 1 } }
        ]
      end

      it "sets the first unassigned device to the MD RAID config" do
        subject.solve(config)
        expect(config.md_raids.size).to eq(2)

        md1, md2 = config.md_raids
        expect(md1.search.solved?).to eq(true)
        expect(md1.search.device.name).to eq("/dev/md0")
        expect(md2.search.solved?).to eq(true)
        expect(md2.search.device.name).to eq("/dev/md1")
      end

      context "and any of the devices is not available" do
        before do
          allow(storage_system.analyzer).to receive(:available_device?) do |dev|
            dev.name != "/dev/md0"
          end
        end

        it "sets the first unassigned candidate device to the MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(2)

          md1, md2 = config.md_raids
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device.name).to eq("/dev/md1")
          expect(md2.search.solved?).to eq(true)
          expect(md2.search.device.name).to eq("/dev/md2")
        end
      end

      context "and there is not unassigned device" do
        let(:md_raids) do
          [
            { search: { max: 1 } },
            { search: { max: 1 } },
            { search: { max: 1 } },
            { search: { max: 1 } }
          ]
        end

        it "does not set a device to the MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(4)

          md4 = config.md_raids.last
          expect(md4.search.solved?).to eq(true)
          expect(md4.search.device).to be_nil
        end
      end
    end

    context "if a MD RAID config contains a search without condition and without max" do
      let(:md_raids) do
        [
          { search: {} }
        ]
      end

      it "expands the number of MD RAID configs to match all the existing MD RAIDs" do
        subject.solve(config)
        expect(config.md_raids.size).to eq(3)

        md1, md2, md3 = config.md_raids
        expect(md1.search.solved?).to eq(true)
        expect(md1.search.device.name).to eq("/dev/md0")
        expect(md2.search.solved?).to eq(true)
        expect(md2.search.device.name).to eq("/dev/md1")
        expect(md3.search.solved?).to eq(true)
        expect(md3.search.device.name).to eq("/dev/md2")
      end

      context "but ordering by descending device name" do
        let(:md_raids) do
          [
            { search: { sort: { name: "desc" } } }
          ]
        end

        it "expands the number of MD RAID configs to match all the existing RAIDs in order" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(3)

          md1, md2, md3 = config.md_raids
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device.name).to eq("/dev/md2")
          expect(md2.search.solved?).to eq(true)
          expect(md2.search.device.name).to eq("/dev/md1")
          expect(md3.search.solved?).to eq(true)
          expect(md3.search.device.name).to eq("/dev/md0")
        end
      end
    end

    context "if a MD RAID config contains a search without conditions but with a max" do
      let(:md_raids) do
        [
          { search: { max: max } }
        ]
      end

      context "and the max is equal or smaller than the number of MD RAIDs" do
        let(:max) { 2 }

        it "expands the number of MD RAID configs to match the max" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(2)

          md1, md2 = config.md_raids
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device.name).to eq("/dev/md0")
          expect(md2.search.solved?).to eq(true)
          expect(md2.search.device.name).to eq("/dev/md1")
        end

        context "but ordering by descending device name" do
          let(:md_raids) do
            [
              { search: { sort: { name: "desc" }, max: max } }
            ]
          end

          it "expands the number of MdRaid configs to match the max considering the order" do
            subject.solve(config)
            expect(config.md_raids.size).to eq(2)

            md1, md2 = config.md_raids
            expect(md1.search.solved?).to eq(true)
            expect(md1.search.device.name).to eq("/dev/md2")
            expect(md2.search.solved?).to eq(true)
            expect(md2.search.device.name).to eq("/dev/md1")
          end
        end
      end

      context "and the max is bigger than the number of MD RAIDs" do
        let(:max) { 20 }

        it "expands the number of MD RAID configs to match all the existing MD RAIDs" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(3)

          md1, md2, md3 = config.md_raids
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device.name).to eq("/dev/md0")
          expect(md2.search.solved?).to eq(true)
          expect(md2.search.device.name).to eq("/dev/md1")
          expect(md3.search.solved?).to eq(true)
          expect(md3.search.device.name).to eq("/dev/md2")
        end
      end
    end

    context "if a MD RAID config has a search with condition" do
      let(:md_raids) do
        [
          { search: search }
        ]
      end

      context "and the device was already assigned" do
        let(:md_raids) do
          [
            { search: { max: 1 } },
            { search: "/dev/md0" }
          ]
        end

        it "does not set a device to the MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(2)

          _, md2 = config.md_raids
          expect(md2.search.solved?).to eq(true)
          expect(md2.search.device).to be_nil
        end
      end

      context "and there is other MD RAID config with the same device" do
        let(:md_raids) do
          [
            { search: "/dev/md1" },
            { search: "/dev/md1" }
          ]
        end

        it "only sets the device to the first MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(2)

          md1, md2 = config.md_raids
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device.name).to eq("/dev/md1")
          expect(md2.search.solved?).to eq(true)
          expect(md2.search.device).to be_nil
        end
      end
    end

    context "if a MD RAID config has a search with a device name" do
      let(:md_raids) do
        [
          { search: search }
        ]
      end

      context "and the device is found" do
        let(:search) { "/dev/md1" }

        it "sets the device to the MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(1)

          md1 = config.md_raids.first
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device.name).to eq("/dev/md1")
        end
      end

      context "and the device is not found" do
        let(:search) { "/dev/md3" }

        # Speed-up fallback search (and make sure it fails)
        before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

        it "does not set a device to the MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(1)

          md1 = config.md_raids.first
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device).to be_nil
        end
      end
    end

    context "if a MD RAID config has a search with a size" do
      let(:scenario) { "sizes.yaml" }

      let(:md_raids) do
        [
          {
            search: {
              condition: { size: size }
            }
          }
        ]
      end

      shared_examples "find device" do |device|
        it "sets the device to the MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(1)

          md1 = config.md_raids.first
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device.name).to eq(device)
        end
      end

      shared_examples "do not find device" do
        it "does not set a device to the MD RAID config" do
          subject.solve(config)
          expect(config.md_raids.size).to eq(1)

          md1 = config.md_raids.first
          expect(md1.search.solved?).to eq(true)
          expect(md1.search.device).to be_nil
        end
      end

      context "and the operator is :equal" do
        let(:size) { { equal: value } }

        context "and there is a MD RAID with equal size" do
          let(:value) { storage_system.devicegraph.find_by_name("/dev/md2").size }
          include_examples "find device", "/dev/md2"
        end

        context "and there is no MD RAID with equal size" do
          let(:size) { "20 GiB" }
          include_examples "do not find device"
        end
      end

      context "and the operator is :greater" do
        let(:size) { { greater: value } }

        context "and there is a MD RAID with greater size" do
          let(:value) { "50 GiB" }
          include_examples "find device", "/dev/md2"
        end

        context "and there is no MD RAID with greater size" do
          let(:value) { "200 GiB" }
          include_examples "do not find device"
        end
      end

      context "and the operator is :less" do
        let(:size) { { less: value } }

        context "and there is a MD RAID with less size" do
          let(:value) { "20 GiB" }
          include_examples "find device", "/dev/md0"
        end

        context "and there is no MD RAID with less size" do
          let(:value) { "10 GiB" }
          include_examples "do not find device"
        end
      end
    end

    context "if a MD RAID config has partitions with search" do
      let(:md_raids) do
        [
          {
            search:     "/dev/md0",
            partitions: [
              { search: {} }
            ]
          }
        ]
      end

      it "solves the search of the partitions" do
        subject.solve(config)
        partitions = config.md_raids.first.partitions
        expect(partitions.size).to eq(2)

        p1, p2 = partitions
        expect(p1.search.solved?).to eq(true)
        expect(p1.search.device.name).to eq("/dev/md0p1")
        expect(p2.search.solved?).to eq(true)
        expect(p2.search.device.name).to eq("/dev/md0p2")
      end
    end

    context "if an mdRaid config sorts the search" do
      let(:scenario) { "sizes.yaml" }

      let(:md_raids) do
        [
          {
            search: {
              condition: condition,
              sort:      sort,
              max:       max
            }
          }
        ]
      end

      let(:max) { 3 }
      let(:condition) { nil }

      context "by size specified as a string" do
        let(:sort) { "size" }

        it "matches the RAIDs in the expected order" do
          subject.solve(config)
          expect(config.md_raids.map(&:search).map(&:device).map(&:name)).to eq [
            "/dev/md0", "/dev/md1", "/dev/md2"
          ]
        end
      end

      context "by size specified as 'desc'" do
        let(:sort) { { size: "desc" } }

        it "matches the RAIDs in the expected order" do
          subject.solve(config)
          expect(config.md_raids.map(&:search).map(&:device).map(&:name)).to eq [
            "/dev/md2", "/dev/md1", "/dev/md0"
          ]
        end

        context "but leaving the smallest RAID out" do
          let(:condition) { { size: { greater: "20 GiB" } } }

          it "matches the RAIDs in the expected order" do
            subject.solve(config)
            expect(config.md_raids.map(&:search).map(&:device).map(&:name)).to eq [
              "/dev/md2", "/dev/md1"
            ]
          end
        end
      end
    end
  end
end
