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
    context "when the config has a partitioned MD Raid and a formatted one" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:  [
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
          mdRaids: [
            {
              level:      "raid1",
              devices:    ["sda1", "sdb1"],
              partitions: [
                { filesystem: { path: "/" } },
                { filesystem: { path: "swap" } }
              ]
            },
            {
              level:      "raid0",
              name:       "home",
              devices:    ["sdb2", "sda2"],
              filesystem: { path: "/home" }
            }
          ],
          boot:    { configure: false }
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.md_raids).to contain_exactly(
          an_object_having_attributes(name: "/dev/md0", md_level: Y2Storage::MdLevel::RAID1),
          an_object_having_attributes(name: "/dev/md/home", md_level: Y2Storage::MdLevel::RAID0)
        )
        raid0 = devicegraph.find_by_name("/dev/md0")
        raid_home = devicegraph.find_by_name("/dev/md/home")

        members0_size = 40.GiB - 2.MiB
        expect(raid0.devices).to contain_exactly(
          an_object_having_attributes(name: "/dev/vda1", size: members0_size),
          an_object_having_attributes(name: "/dev/vdb1", size: members0_size)
        )
        # Ensure proper order
        expect(raid0.devices.map(&:name)).to eq ["/dev/vda1", "/dev/vdb1"]

        members_home_size = 10.GiB + 1.MiB - 16.5.KiB
        expect(raid_home.devices).to contain_exactly(
          an_object_having_attributes(name: "/dev/vda2", size: members_home_size),
          an_object_having_attributes(name: "/dev/vdb2", size: members_home_size)
        )
        # Ensure proper order
        expect(raid_home.devices.map(&:name)).to eq ["/dev/vdb2", "/dev/vda2"]

        expect(raid0.partitions.size).to eq 2
        mount_points = raid0.partitions.map { |p| p.filesystem.mount_path }
        expect(mount_points).to contain_exactly("/", "swap")

        expect(raid_home.partitions.size).to eq 0
        expect(raid_home.filesystem.mount_path).to eq "/home"
      end
    end

    context "when creating a MD Raid on top of several devices with the same alias" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:  [
            {
              search: { max: 10 },
              alias:  "all-disks"
            }
          ],
          mdRaids: [
            {
              level:      "raid1",
              devices:    ["all-disks"],
              filesystem: { path: "/" }
            }
          ],
          boot:    { configure: false }
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.md_raids.size).to eq 1
        raid = devicegraph.md_raids.first

        expect(raid.devices.map(&:name)).to contain_exactly("/dev/vda", "/dev/vdb", "/dev/vdc")
        expect(raid.filesystem.mount_path).to eq "/"
      end
    end

    context "when specifying chunk size and parity" do
      let(:scenario) { "disks.yaml" }

      let(:config_json) do
        {
          drives:  [
            {
              search: { max: 3 },
              alias:  "all-disks"
            }
          ],
          mdRaids: [
            {
              level:      "raid5",
              parity:     "right_asymmetric",
              chunkSize:  "256KiB",
              devices:    ["all-disks"],
              filesystem: { path: "/" }
            }
          ],
          boot:    { configure: false }
        }
      end

      it "proposes the expected devices" do
        devicegraph = proposal.propose

        expect(devicegraph.md_raids.size).to eq 1
        raid = devicegraph.md_raids.first

        expect(raid.md_level).to eq Y2Storage::MdLevel::RAID5
        expect(raid.chunk_size).to eq 256.KiB
        expect(raid.md_parity).to eq Y2Storage::MdParity::RIGHT_ASYMMETRIC
      end
    end

    context "when formatting an existing RAID" do
      let(:scenario) { "partitioned_md.yml" }

      let(:config_json) do
        {
          mdRaids: [
            {
              search:     { max: 1 },
              filesystem: { path: "/" }
            }
          ],
          boot:    { configure: false }
        }
      end

      it "uses the RAID" do
        md_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/md0").sid
        proposal.propose

        md = proposal.devices.find_by_name("/dev/md0")
        expect(md.sid).to eq md_sid
        expect(md.partitions).to be_empty
        expect(md.filesystem.mount_path).to eq "/"
      end
    end

    context "when deleting existing partitions from an existing RAID" do
      let(:scenario) { "partitioned_md.yml" }

      let(:config_json) do
        {
          mdRaids: [
            {
              search:     { max: 1 },
              partitions: [
                { search: "*", delete: true },
                { filesystem: { path: "/" } },
                { filesystem: { path: "swap" } }
              ]
            }
          ],
          boot:    { configure: false }
        }
      end

      it "uses the RAID for the new partitions" do
        md_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/md0").sid
        proposal.propose

        md = proposal.devices.find_by_name("/dev/md0")
        expect(md.sid).to eq md_sid
        expect(md.partitions.size).to eq 2
        paths = md.partitions.map(&:filesystem).map(&:mount_path)
        expect(paths).to contain_exactly("/", "swap")
      end
    end

    context "when deleting existing partitions on demand from an existing RAID" do
      let(:scenario) { "partitioned_md.yml" }

      let(:config_json) do
        {
          mdRaids: [
            {
              search:     { max: 1 },
              partitions: [
                { search: "*", deleteIfNeeded: true },
                { filesystem: { path: "/" }, size: parts_size },
                { filesystem: { path: "swap" }, size: parts_size }
              ]
            }
          ],
          boot:    { configure: false }
        }
      end

      context "if there is no need to delete the partition" do
        let(:parts_size) { "5 GiB" }

        it "keeps the partition and creates the new ones" do
          md_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/md0").sid
          proposal.propose

          md = proposal.devices.find_by_name("/dev/md0")
          expect(md.sid).to eq md_sid
          expect(md.partitions.size).to eq 3
          filesystems = md.partitions.map(&:filesystem)
          expect(filesystems).to contain_exactly(
            nil,
            an_object_having_attributes(mount_path: "/"),
            an_object_having_attributes(mount_path: "swap")
          )
        end
      end

      context "if the partition must be deleted" do
        let(:parts_size) { "9.7 GiB" }

        it "deletes the original partition and creates the new ones" do
          md_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/md0").sid
          proposal.propose

          md = proposal.devices.find_by_name("/dev/md0")
          expect(md.sid).to eq md_sid
          expect(md.partitions.size).to eq 2
          paths = md.partitions.map(&:filesystem).map(&:mount_path)
          expect(paths).to contain_exactly("/", "swap")
        end
      end
    end

    context "when reusing partitions from an existing RAID" do
      let(:scenario) { "partitioned_md.yml" }

      let(:config_json) do
        {
          mdRaids: [
            {
              search:     "/dev/md0",
              partitions: [
                { search: { max: 1 }, filesystem: { path: "/" } }
              ]
            }
          ],
          boot:    { configure: false }
        }
      end

      it "reuses the RAID and its partition" do
        md_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/md0").sid
        part_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/md0p1").sid
        proposal.propose

        md = proposal.devices.find_by_name("/dev/md0")
        expect(md.sid).to eq md_sid
        expect(md.partitions.size).to eq 1
        partition = md.partitions.first
        expect(partition.filesystem.mount_path).to eq "/"
        expect(partition.sid).to eq part_sid
      end
    end

    context "when configuring explicit boot from an existing RAID" do
      let(:scenario) { "partitioned_md.yml" }

      let(:config_json) do
        {
          mdRaids: [
            {
              search:     { max: 1 },
              alias:      "raid",
              partitions: [
                { search: "*", delete: true },
                { filesystem: { path: "/" } }
              ]
            }
          ],
          boot:    { configure: true, device: "raid" }
        }
      end

      it "allocates the boot partition in the RAID" do
        md_sid = Y2Storage::StorageManager.instance.probed.find_by_name("/dev/md0").sid
        proposal.propose

        md = proposal.devices.find_by_name("/dev/md0")
        expect(md.sid).to eq md_sid
        expect(md.partitions.size).to eq 2
        expect(md.partitions.first.id).to eq Y2Storage::PartitionId::BIOS_BOOT
      end
    end

    context "when creating several MD Raids with several partitions each" do
      let(:scenario) { "nvme-disks.yaml" }

      let(:config_json) do
        {
          drives:  [
            {
              search:     "/dev/nvme0n1",
              partitions: [
                { alias: "nvme0n1-p0", id: "raid", size: { min: "1 MiB" } }
              ]
            },
            {
              search:     "/dev/nvme1n1",
              partitions: [
                { alias: "nvme1n1-p0", id: "raid", size: { min: "1 MiB" } }
              ]
            },
            {
              search:     "/dev/nvme2n1",
              partitions: [
                { alias: "nvme2n1-p0", id: "raid", size: { min: "1 MiB" } }
              ]
            },
            {
              search:     "/dev/nvme3n1",
              partitions: [
                { alias: "nvme3n1-p0", id: "raid", size: { min: "1 MiB" } }
              ]
            }
          ],
          mdRaids: [
            {
              level:      "raid0",
              devices:    ["nvme0n1-p0", "nvme1n1-p0"],
              partitions: [
                { size: "512 MiB", filesystem: { path: "/boot/efi" } },
                { size: "512 MiB", filesystem: { path: "/boot" } },
                { size: "93 GiB", filesystem: { path: "/" } },
                { size: { min: "1 MiB" }, filesystem: { path: "/data0" } }
              ]
            },
            {
              level:      "raid1",
              devices:    ["nvme2n1-p0", "nvme3n1-p0"],
              partitions: [
                { size: { min: "1 MiB" }, filesystem: { path: "/data1" } }
              ]
            }
          ],
          boot:    { configure: false }
        }
      end

      # Regression test for bsc#1253145
      # The small partitions /boot and /boot/efi were located to the second RAID to optimize space
      # distribution. Something that should obviously not happen.
      it "locates each partition into its corresponding RAID device" do
        devicegraph = proposal.propose

        raid0 = devicegraph.md_raids.find { |i| i.md_level.is?(:raid0) }
        expect(raid0.partitions.map(&:filesystem).map(&:mount_path)).to contain_exactly(
          "/boot", "/boot/efi", "/", "/data0"
        )

        raid1 = devicegraph.md_raids.find { |i| i.md_level.is?(:raid1) }
        expect(raid1.partitions.map(&:filesystem).map(&:mount_path)).to eq ["/data1"]
      end
    end
  end
end
