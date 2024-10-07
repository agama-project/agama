# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "y2storage"
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  using Y2Storage::Refinements::SizeCasts
  include Agama::RSpec::StorageHelpers

  subject(:proposal) do
    described_class.new(config, issues_list: issues_list)
  end

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
    context "when the config has LVM volume groups" do
      let(:scenario) { "empty-hd-50GiB.yaml" }

      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                {
                  alias: "system-pv",
                  size:  "40 GiB"
                },
                {
                  alias: "vg1-pv",
                  size:  "5 GiB"
                }
              ]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              extentSize:      "2 MiB",
              physicalVolumes: ["system-pv"],
              logicalVolumes:  [
                {
                  name:       "root",
                  size:       "10 GiB",
                  filesystem: {
                    path: "/",
                    type: "btrfs"
                  },
                  encryption: {
                    luks2: { password: "12345" }
                  }
                },
                {
                  alias:      "system-pool",
                  name:       "pool",
                  pool:       true,
                  size:       "20 GiB",
                  stripes:    10,
                  stripeSize: "4 KiB"
                },
                {
                  name:       "data",
                  size:       "50 GiB",
                  usedPool:   "system-pool",
                  filesystem: { type: "xfs" }
                }
              ]
            },
            {
              name:            "vg1",
              physicalVolumes: ["vg1-pv"],
              logicalVolumes:  [
                {
                  name:       "home",
                  filesystem: {
                    path: "/home",
                    type: "xfs"
                  },
                  size:       "2 GiB"
                }
              ]
            }
          ]
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.lvm_vgs).to contain_exactly(
          an_object_having_attributes(
            vg_name:     "system",
            extent_size: 2.MiB
          ),
          an_object_having_attributes(
            vg_name:     "vg1",
            extent_size: 4.MiB
          )
        )

        system_vg = devicegraph.find_by_name("/dev/system")
        system_pvs = system_vg.lvm_pvs.map(&:plain_blk_device)
        system_lvs = system_vg.lvm_lvs

        expect(system_pvs).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda2", size: 40.GiB)
        )
        expect(system_lvs).to contain_exactly(
          an_object_having_attributes(
            lv_name:    "root",
            lv_type:    Y2Storage::LvType::NORMAL,
            size:       10.GiB,
            filesystem: an_object_having_attributes(
              type:       Y2Storage::Filesystems::Type::BTRFS,
              mount_path: "/"
            ),
            encryption: an_object_having_attributes(
              type:     Y2Storage::EncryptionType::LUKS2,
              password: "12345"
            )
          ),
          an_object_having_attributes(
            lv_name:     "pool",
            lv_type:     Y2Storage::LvType::THIN_POOL,
            size:        20.GiB,
            filesystem:  be_nil,
            encryption:  be_nil,
            stripes:     10,
            stripe_size: 4.KiB,
            lvm_lvs:     contain_exactly(
              an_object_having_attributes(
                lv_name:    "data",
                lv_type:    Y2Storage::LvType::THIN,
                size:       50.GiB,
                filesystem: an_object_having_attributes(
                  type: Y2Storage::Filesystems::Type::XFS
                )
              )
            )
          )
        )

        vg1 = devicegraph.find_by_name("/dev/vg1")
        vg1_pvs = vg1.lvm_pvs.map(&:plain_blk_device)
        vg1_lvs = vg1.lvm_lvs
        expect(vg1_pvs).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda3", size: 5.GiB)
        )
        expect(vg1_lvs).to contain_exactly(
          an_object_having_attributes(
            lv_name:    "home",
            lv_type:    Y2Storage::LvType::NORMAL,
            size:       2.GiB,
            filesystem: an_object_having_attributes(
              type:       Y2Storage::Filesystems::Type::XFS,
              mount_path: "/home"
            )
          )
        )
      end
    end

    context "when a LVM physical volume is not found" do
      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                {
                  size: "40 GiB"
                },
                {
                  alias: "pv1",
                  size:  "5 GiB"
                }
              ]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              extentSize:      "2 MiB",
              physicalVolumes: ["pv1", "pv2"],
              logicalVolumes:  [
                {
                  name:       "root",
                  filesystem: {
                    path: "/"
                  }
                }
              ]
            }
          ]
        }
      end

      it "aborts the proposal process" do
        proposal.propose
        expect(proposal.failed?).to eq true
      end

      it "reports the corresponding error" do
        proposal.propose
        expect(proposal.issues_list).to include an_object_having_attributes(
          description: /no LVM physical volume with alias 'pv2'/,
          severity:    Agama::Issue::Severity::ERROR
        )
      end
    end

    context "when a LVM thin pool volume is not found" do
      let(:config_json) do
        {
          drives:       [
            {
              partitions: [
                {
                  size: "40 GiB"
                },
                {
                  alias: "pv1",
                  size:  "5 GiB"
                }
              ]
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              extentSize:      "2 MiB",
              physicalVolumes: ["pv1"],
              logicalVolumes:  [
                {
                  pool: true
                },
                {
                  name:       "root",
                  filesystem: {
                    path: "/"
                  },
                  usedPool:   "pool"
                }
              ]
            }
          ]
        }
      end

      it "aborts the proposal process" do
        proposal.propose
        expect(proposal.failed?).to eq true
      end

      it "reports the corresponding error" do
        proposal.propose
        expect(proposal.issues_list).to include an_object_having_attributes(
          description: /no LVM thin pool volume with alias 'pool'/,
          severity:    Agama::Issue::Severity::ERROR
        )
      end
    end

    context "when the config has LVM volume groups with generated physical volumes" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:       [
            {
              alias:      "vda",
              partitions: [
                {
                  search: "/dev/vda2",
                  size:   { min: "0", max: "current" }
                },
                {
                  size: { min: "4 GiB" },
                  filesystem: { path: "/foo" }
                }
              ]
            },
            {
              alias:      "vdb"
            },
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: [
                { generate: { targetDevices: ["vda"] } }
              ],
              logicalVolumes:  [
                {
                  name:       "root",
                  size:       "10 GiB",
                  filesystem: {
                    path: "/",
                    type: "btrfs"
                  }
                },
                {
                  name:       "data",
                  size:       "10 GiB",
                  filesystem: { type: "xfs" }
                }
              ]
            },
            {
              name:            "vg1",
              physicalVolumes: [
                { generate: {
                    targetDevices: ["vdb"],
                    "encryption": { "luks2": { "password": "s3cr3t" } }
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
                  size:       "20 GiB"
                }
              ]
            }
          ]
        }
      end

      before do
        allow_any_instance_of(Y2Storage::Partition)
          .to(receive(:detect_resize_info))
          .and_return(resize_info)
      end

      let(:resize_info) do
        instance_double(
          Y2Storage::ResizeInfo, resize_ok?: true,
          min_size: Y2Storage::DiskSize::GiB(3), max_size: Y2Storage::DiskSize::GiB(35)
        )
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        resized = devicegraph.find_by_name("/dev/vda2")
        expect(resized.filesystem.label).to eq("previous_root")
        expect(resized.size).to be > 15.GiB
        expect(resized.size).to be < 16.GiB

        foo = devicegraph.find_by_name("/dev/vda4")
        expect(foo.filesystem.mount_path).to eq("/foo")
        expect(foo.size).to be > 4.GiB
        expect(foo.size).to be < 5.GiB

        system = devicegraph.find_by_name("/dev/system")
        expect(system.lvm_lvs.size).to eq 2
        expect(Y2Storage::DiskSize.sum(system.lvm_lvs.map(&:size))).to eq 20.GiB
        expect(system.lvm_pvs.size).to eq 2

        vg1 = devicegraph.find_by_name("/dev/vg1")
        expect(vg1.lvm_lvs.size).to eq 1
        expect(vg1.lvm_lvs.first.size).to eq 20.GiB
        expect(vg1.lvm_pvs.size).to eq 1

        pv_vg1 = vg1.lvm_pvs.first
        expect(pv_vg1.blk_device.is?(:encryption)).to eq true
        expect(pv_vg1.blk_device.type.is?(:luks2)).to eq true
      end
    end
  end
end
