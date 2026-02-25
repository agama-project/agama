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

require_relative "../agama/storage/storage_helpers"
require "agama/config"
require "agama/storage/config"
require "agama/storage/config_conversions/from_json"
require "agama/storage/system"
require "y2storage"
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  using Y2Storage::Refinements::SizeCasts
  include Agama::RSpec::StorageHelpers

  subject(:proposal) do
    described_class.new(config, storage_system, issues_list: issues_list)
  end

  let(:storage_system) { Agama::Storage::System.new }

  let(:config) { config_from_json }

  let(:config_from_json) do
    Agama::Storage::ConfigConversions::FromJSON
      .new(config_json)
      .convert
  end

  let(:issues_list) { [] }

  before do
    mock_storage(devicegraph: scenario)
    # To speed-up the tests
    allow(Y2Storage::EncryptionMethod::TPM_FDE).to receive(:possible?).and_return(true)
  end

  let(:scenario) { "empty-hd-50GiB.yaml" }

  describe "#propose" do
    context "when the config defines a new LVM using a new RAID as PV" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                { search: "*", delete: true },
                { alias: "sda1", size: { min: "1 MiB" } }
              ]
            },
            {
              partitions: [
                { search: "*", delete: true },
                { alias: "sdb1", size: { min: "1 MiB" } }
              ]
            }
          ],
          mdRaids:      [
            {
              level:   "raid1",
              alias:   "md",
              devices: ["sda1", "sdb1"]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: ["md"],
              logicalVolumes:  [
                { name: "root", filesystem: { path: "/" } },
                { name: "swap", filesystem: { path: "swap" } }
              ]
            }
          ],
          boot:         { configure: false }
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.md_raids).to contain_exactly(
          an_object_having_attributes(name: "/dev/md0", md_level: Y2Storage::MdLevel::RAID1)
        )
        expect(devicegraph.lvm_vgs).to contain_exactly(
          an_object_having_attributes(vg_name: "system")
        )
        vg = devicegraph.lvm_vgs.first
        expect(vg.lvm_lvs.map(&:name)).to contain_exactly(
          "/dev/system/root", "/dev/system/swap"
        )
        expect(vg.lvm_pvs.size).to eq 1
        expect(vg.lvm_pvs.first.blk_device.name).to eq "/dev/md0"
      end
    end

    context "when the config defines a new LVM generating PVs on a new RAID" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                { search: "*", delete: true },
                { alias: "sda1", size: { min: "1 MiB" } }
              ]
            },
            {
              partitions: [
                { search: "*", delete: true },
                { alias: "sdb1", size: { min: "1 MiB" } }
              ]
            }
          ],
          mdRaids:      [
            {
              level:   "raid1",
              alias:   "md",
              devices: ["sda1", "sdb1"]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: [
                { generate: { targetDevices: ["md"] } }
              ],
              logicalVolumes:  [
                { name: "root", size: { min: "10 GiB" }, filesystem: { path: "/" } },
                { name: "swap", size: "2 GiB", filesystem: { path: "swap" } }
              ]
            }
          ],
          boot:         { configure: false }
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.md_raids).to contain_exactly(
          an_object_having_attributes(name: "/dev/md0", md_level: Y2Storage::MdLevel::RAID1)
        )
        expect(devicegraph.lvm_vgs).to contain_exactly(
          an_object_having_attributes(vg_name: "system")
        )
        vg = devicegraph.lvm_vgs.first
        expect(vg.lvm_lvs.map(&:name)).to contain_exactly(
          "/dev/system/root", "/dev/system/swap"
        )
        expect(vg.lvm_pvs.size).to eq 1
        expect(vg.lvm_pvs.first.blk_device.name).to eq "/dev/md0p1"
      end
    end

    context "when the config defines several LVM generating PVs on several new RAIDs" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                { search: "*", delete: true },
                { alias: "sda1", size: { min: "1 MiB" } },
                { alias: "sda2", size: "10 GiB" }
              ]
            },
            {
              partitions: [
                { search: "*", delete: true },
                { alias: "sdb1", size: { min: "1 MiB" } },
                { alias: "sdb2", size: "10 GiB" }
              ]
            }
          ],
          mdRaids:      [
            {
              level:   "raid1",
              alias:   "md0",
              devices: ["sda1", "sdb1"]
            },
            {
              level:      "raid0",
              alias:      "md1",
              devices:    ["sdb2", "sda2"],
              partitions: [
                { filesystem: { path: "/extra" }, size: "1GiB" }
              ]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: [
                { generate: { targetDevices: ["md0", "md1"] } }
              ],
              logicalVolumes:  [
                { name: "root", size: { min: "20 GiB" }, filesystem: { path: "/" } },
                { name: "swap", size: "1 GiB", filesystem: { path: "swap" } }
              ]
            },
            {
              name:            "vg1",
              physicalVolumes: [
                {
                  generate: {
                    targetDevices: ["md1"],
                    encryption:    { luks2: { password: "s3cr3t" } }
                  }
                }
              ],
              logicalVolumes:  [
                {
                  name:       "home",
                  filesystem: {
                    path: "/home",
                    type: "xfs"
                  },
                  size:       "3 GiB"
                }
              ]
            }
          ],
          boot:         { configure: false }
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.md_raids).to contain_exactly(
          an_object_having_attributes(name: "/dev/md0", md_level: Y2Storage::MdLevel::RAID1),
          an_object_having_attributes(name: "/dev/md1", md_level: Y2Storage::MdLevel::RAID0)
        )
        md0 = devicegraph.md_raids.find { |r| r.md_level.is?(:raid0) }
        md0_formatted = md0.partitions.select(&:formatted?)
        expect(md0_formatted.map(&:filesystem).map(&:mount_path)).to include "/extra"

        expect(devicegraph.lvm_vgs).to contain_exactly(
          an_object_having_attributes(vg_name: "system"),
          an_object_having_attributes(vg_name: "vg1")
        )

        vg_system = devicegraph.find_by_any_name("/dev/system")
        expect(vg_system.lvm_lvs.map(&:name)).to contain_exactly(
          "/dev/system/root", "/dev/system/swap"
        )
        pvs_system = vg_system.lvm_pvs.map(&:blk_device)
        expect(pvs_system.map(&:partitionable).map(&:name))
          .to contain_exactly("/dev/md0", "/dev/md1")

        vg1 = devicegraph.find_by_any_name("/dev/vg1")
        expect(vg1.lvm_lvs.map(&:name)).to contain_exactly("/dev/vg1/home")
        pvs_vg1 = vg1.lvm_pvs.map(&:blk_device)
        expect(pvs_vg1.size).to eq 1

        pv = pvs_vg1.first
        expect(pv.is?(:encryption)).to eq true
        expect(pv.blk_device.partitionable).to eq md0
      end
    end
  end
end
