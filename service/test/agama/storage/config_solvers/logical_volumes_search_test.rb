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
require "agama/storage/config_solvers/logical_volumes_search"
require "y2storage"

describe Agama::Storage::ConfigSolvers::LogicalVolumesSearch do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new }

  let(:devicegraph) { Y2Storage::StorageManager.instance.probed }

  before do
    mock_storage(devicegraph: scenario)
  end

  describe "#solve" do
    let(:scenario) { "several_vgs.yaml" }

    let(:config_json) do
      {
        volumeGroups: [
          {
            search:         "/dev/system",
            logicalVolumes: logical_volumes
          }
        ]
      }
    end

    let(:config) do
      Agama::Storage::ConfigConversions::FromJSON
        .new(config_json)
        .convert
    end

    let(:volume_group) { config.volume_groups.first }

    context "if the volume group config is not solved yet" do
      let(:logical_volumes) do
        [
          { search: {} },
          { search: {} }
        ]
      end

      it "does not set LVs to the logical volume configs" do
        subject.solve(volume_group)
        lv1, lv2 = volume_group.logical_volumes
        expect(lv1.search.solved?).to eq(true)
        expect(lv1.search.device).to be_nil
        expect(lv2.search.solved?).to eq(true)
        expect(lv2.search.device).to be_nil
      end
    end

    context "if the volume_group config is solved" do
      before do
        volume_group.search.solve(vg)
      end

      let(:vg) { devicegraph.find_by_name("/dev/system") }

      context "if a logical volume config has a search without condition and without max" do
        let(:logical_volumes) do
          [
            { search: {} }
          ]
        end

        it "expands the number of logical volume configs to match all the existing LVs" do
          subject.solve(volume_group)
          logical_volumes = volume_group.logical_volumes
          expect(logical_volumes.size).to eq(2)

          lv1, lv2 = logical_volumes
          expect(lv1.search.solved?).to eq(true)
          expect(lv1.search.device.name).to eq("/dev/system/root")
          expect(lv2.search.solved?).to eq(true)
          expect(lv2.search.device.name).to eq("/dev/system/swap")
        end

        context "and there are more logical volume searches without name" do
          let(:logical_volumes) do
            [
              { search: {} },
              { search: {} },
              { search: "*" }
            ]
          end

          it "does not set a device to the surpluss configs" do
            subject.solve(volume_group)
            logical_volumes = volume_group.logical_volumes
            expect(logical_volumes.size).to eq(4)

            _, _, lv3, lv4 = logical_volumes
            expect(lv3.search.solved?).to eq(true)
            expect(lv3.search.device).to be_nil
            expect(lv4.search.solved?).to eq(true)
            expect(lv4.search.device).to be_nil
          end
        end
      end
    end
  end
end
