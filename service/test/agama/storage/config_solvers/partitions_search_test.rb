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
require "agama/storage/config_solvers/partitions_search"
require "y2storage"

describe Agama::Storage::ConfigSolvers::PartitionsSearch do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  before do
    mock_storage(devicegraph: scenario)
  end

  describe "#solve" do
    let(:scenario) { "disks.yaml" }

    let(:config_json) do
      {
        drives: [
          {
            partitions: partitions
          }
        ]
      }
    end

    let(:config) do
      Agama::Storage::ConfigConversions::FromJSON
        .new(config_json)
        .convert
    end

    let(:drive) { config.drives.first }

    context "if the drive config is not solved yet" do
      let(:partitions) do
        [
          { search: {} },
          { search: {} }
        ]
      end

      it "does not set a partition to the partition configs" do
        subject.solve(drive)
        p1, p2 = drive.partitions
        expect(p1.search.solved?).to eq(true)
        expect(p1.search.device).to be_nil
        expect(p2.search.solved?).to eq(true)
        expect(p2.search.device).to be_nil
      end
    end

    context "if the drive config is solved" do
      before do
        drive.search.solve(disk)
      end

      let(:disk) { devicegraph.find_by_name("/dev/vda") }

      context "if a partition config has a search without condition and without max" do
        let(:partitions) do
          [
            { search: {} }
          ]
        end

        it "expands the number of partition configs to match all the existing partitions" do
          subject.solve(drive)
          partitions = drive.partitions
          expect(partitions.size).to eq(3)

          p1, p2, p3 = partitions
          expect(p1.search.solved?).to eq(true)
          expect(p1.search.device.name).to eq("/dev/vda1")
          expect(p2.search.solved?).to eq(true)
          expect(p2.search.device.name).to eq("/dev/vda2")
          expect(p3.search.solved?).to eq(true)
          expect(p3.search.device.name).to eq("/dev/vda3")
        end

        context "and there are more partition searches without name" do
          let(:partitions) do
            [
              { search: {} },
              { search: {} },
              { search: "*" }
            ]
          end

          it "does not set a device to the surpluss configs" do
            subject.solve(drive)
            partitions = drive.partitions
            expect(partitions.size).to eq(5)

            _, _, _, p4, p5 = partitions
            expect(p4.search.solved?).to eq(true)
            expect(p4.search.device).to be_nil
            expect(p5.search.solved?).to eq(true)
            expect(p5.search.device).to be_nil
          end
        end
      end

      context "if a partition config contains a search without condition but with a max" do
        let(:partitions) do
          [
            { search: { max: max } }
          ]
        end

        context "and the max is equal or smaller than the number of partitions on the device" do
          let(:max) { 2 }

          it "expands the number of partition configs to match the max" do
            subject.solve(drive)
            partitions = drive.partitions
            expect(partitions.size).to eq(2)

            p1, p2 = partitions
            expect(p1.search.solved?).to eq(true)
            expect(p1.search.device.name).to eq("/dev/vda1")
            expect(p2.search.solved?).to eq(true)
            expect(p2.search.device.name).to eq("/dev/vda2")
          end
        end

        context "and the max is bigger than the number of partitions on the device" do
          let(:max) { 20 }

          it "expands the number of configs to match all the existing partitions" do
            subject.solve(drive)
            partitions = drive.partitions
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

      context "if a partition config has a search with condition" do
        let(:partitions) do
          [
            { search: search }
          ]
        end

        context "and the device was already assigned" do
          let(:partitions) do
            [
              { search: {} },
              { search: "/dev/vda1" }
            ]
          end

          it "does not set a partition to the config" do
            subject.solve(drive)
            p = drive.partitions.last
            expect(p.search.solved?).to eq(true)
            expect(p.search.device).to be_nil
          end
        end

        context "and there is other partition with the same device" do
          let(:partitions) do
            [
              { search: "/dev/vda2" },
              { search: "/dev/vda2" }
            ]
          end

          it "only sets the partition to the first partition config" do
            subject.solve(drive)
            expect(partitions.size).to eq(2)

            p1, p2 = drive.partitions
            expect(p1.search.solved?).to eq(true)
            expect(p1.search.device.name).to eq("/dev/vda2")
            expect(p2.search.solved?).to eq(true)
            expect(p2.search.device).to be_nil
          end
        end
      end

      shared_examples "find device" do |device|
        it "sets the device to the partition config" do
          subject.solve(drive)
          partitions = drive.partitions
          expect(partitions.size).to eq(1)

          p1 = partitions.first
          expect(p1.search.solved?).to eq(true)
          expect(p1.search.device.name).to eq(device)
        end
      end

      shared_examples "do not find device" do
        it "does not set a device to the partition config" do
          subject.solve(drive)
          partitions = drive.partitions
          expect(partitions.size).to eq(1)

          p1 = partitions.first
          expect(p1.search.solved?).to eq(true)
          expect(p1.search.device).to be_nil
        end
      end

      context "if a partition config has a search with a device name" do
        let(:partitions) do
          [
            { search: search }
          ]
        end

        context "and the partition is found" do
          let(:search) { "/dev/vda2" }
          include_examples "find device", "/dev/vda2"
        end

        context "and the device is not found" do
          # Speed-up fallback search (and make sure it fails)
          before { allow(Y2Storage::BlkDevice).to receive(:find_by_any_name) }

          let(:search) { "/dev/vdb1" }
          include_examples "do not find device"
        end
      end

      context "if a partition config has a search with a size" do
        let(:scenario) { "sizes.yaml" }

        let(:partitions) do
          [
            {
              search: {
                condition: { size: size }
              }
            }
          ]
        end

        context "and the operator is :equal" do
          let(:size) { { equal: value } }

          context "and there is a partition with equal size" do
            let(:value) { "20 GiB" }
            include_examples "find device", "/dev/vda2"
          end

          context "and there is no partition with equal size" do
            let(:size) { "21 GiB" }
            include_examples "do not find device"
          end
        end

        context "and the operator is :greater" do
          let(:size) { { greater: value } }

          context "and there is a partition with greater size" do
            let(:value) { "20 GiB" }
            include_examples "find device", "/dev/vda3"
          end

          context "and there is no partition with greater size" do
            let(:value) { "200 GiB" }
            include_examples "do not find device"
          end
        end

        context "and the operator is :less" do
          let(:size) { { less: value } }

          context "and there is a partition with less size" do
            let(:value) { "20 GiB" }
            include_examples "find device", "/dev/vda1"
          end

          context "and there is no partition with less size" do
            let(:value) { "1 GiB" }
            include_examples "do not find device"
          end
        end
      end

      context "if a partition config has a search with a partition number" do
        let(:scenario) { "sizes.yaml" }

        let(:partitions) do
          [
            {
              search: {
                condition: { number: number }
              }
            }
          ]
        end

        context "and the partition is found" do
          let(:number) { 2 }
          include_examples "find device", "/dev/vda2"
        end

        context "and the device is not found" do
          let(:number) { 20 }
          include_examples "do not find device"
        end
      end

      context "if a partition config has a search with sorting" do
        let(:scenario) { "sizes.yaml" }
        let(:disk) { devicegraph.find_by_name("/dev/vdb") }

        let(:partitions) do
          [
            {
              search: {
                sort: sort
              }
            }
          ]
        end

        context "by size" do
          let(:sort) { { size: "desc" } }

          it "matches the partitions in the expected order" do
            subject.solve(drive)
            partitions = drive.partitions
            expect(partitions.map(&:search).map(&:device).map(&:name)).to eq [
              "/dev/vdb2", "/dev/vdb3", "/dev/vdb1"
            ]
          end
        end

        context "by size and partition number" do
          let(:sort) { [{ size: "desc" }, { number: "desc" }] }

          it "matches the partitions in the expected order" do
            subject.solve(drive)
            partitions = drive.partitions
            expect(partitions.map(&:search).map(&:device).map(&:name)).to eq [
              "/dev/vdb3", "/dev/vdb2", "/dev/vdb1"
            ]
          end
        end
      end
    end
  end
end
