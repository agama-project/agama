#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) 2016 SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

describe Y2Storage::YamlWriter do
  include_context "yast2-storage-ng test setup"

  before do
    Y2Storage::StorageManager.create_test_instance
  end

  let(:staging) { Y2Storage::StorageManager.instance.staging }

  def plain_content(content)
    content.split("\n").map(&:lstrip).join("\n")
  end

  describe ".write" do
    let(:io) { StringIO.new }

    context "when the devicegraph contains a simple DASD disk setup" do
      before do
        sda = Y2Storage::Dasd.create(staging, "/dev/sda")
        sda.size = 256 * Storage.GiB
        sda.type = Y2Storage::DasdType::ECKD
        sda.format = Y2Storage::DasdFormat::LDL

        sda.create_partition_table(Y2Storage::PartitionTables::Type::DASD)
      end

      let(:expected_result) do
        %(---
          - dasd:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              type: eckd
              format: ldl
              partition_table: dasd
              partitions:
              - free:
                  size: 256 GiB
                  start: 0 B)
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a simple disk and partition setup" do
      before do
        sda = Y2Storage::Disk.create(staging, "/dev/sda")
        sda.size = 256 * Storage.GiB

        gpt = sda.create_partition_table(Y2Storage::PartitionTables::Type::GPT)

        sda1 = gpt.create_partition("/dev/sda1", Y2Storage::Region.create(2048, 1048576, 512),
          Y2Storage::PartitionType::PRIMARY)
        sda1.id = Y2Storage::PartitionId::SWAP

        swap = sda1.create_filesystem(Y2Storage::Filesystems::Type::SWAP)
        swap.create_mount_point("swap")

        sda2 = gpt.create_partition("/dev/sda2", Y2Storage::Region.create(1050624, 33554432, 512),
          Y2Storage::PartitionType::PRIMARY)

        ext4 = sda2.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
        ext4.create_mount_point("/")
        ext4.mount_point.mount_options = ["acl", "user_xattr"]
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: gpt
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 0.5 GiB
                  start: 1 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: swap
                  file_system: swap
                  mount_point: swap
              - partition:
                  size: 16 GiB
                  start: 513 MiB (0.50 GiB)
                  name: "/dev/sda2"
                  type: primary
                  id: linux
                  file_system: ext4
                  mount_point: "/"
                  fstab_options:
                  - acl
                  - user_xattr
              - free:
                  size: 245247 MiB (239.50 GiB)
                  start: 16897 MiB (16.50 GiB))
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a simple lvm setup" do
      before do
        sda = Y2Storage::Disk.create(staging, "/dev/sda")
        sda.size = 1 * Storage.TiB

        lvm_vg = Y2Storage::LvmVg.create(staging, "system")
        lvm_vg.add_lvm_pv(sda)

        lvm_lv = lvm_vg.create_lvm_lv("root", 16 * Storage.GiB)
        lvm_lv.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 1 TiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
          - lvm_vg:
              vg_name: system
              extent_size: 4 MiB
              lvm_lvs:
              - lvm_lv:
                  lv_name: root
                  size: 16 GiB
                  stripes: 1
                  file_system: ext4
              lvm_pvs:
              - lvm_pv:
                  blk_device: "/dev/sda")
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a simple DASD disk setup" do
      before do
        sda = Y2Storage::Disk.create(staging, "/dev/sda")
        sda.size = 256 * Storage.GiB

        gpt = sda.create_partition_table(Y2Storage::PartitionTables::Type::GPT)

        sda1 = gpt.create_partition("/dev/sda1", Y2Storage::Region.create(2048, 1048576, 512),
          Y2Storage::PartitionType::PRIMARY)
        sda1.id = Y2Storage::PartitionId::SWAP

        swap = sda1.create_filesystem(Y2Storage::Filesystems::Type::SWAP)
        swap.create_mount_point("swap")

        sda2 = gpt.create_partition("/dev/sda2", Y2Storage::Region.create(1050624, 33554432, 512),
          Y2Storage::PartitionType::PRIMARY)

        encryption = sda2.create_encryption("cr_system")
        encryption.password = "vry!s3cret"

        ext4 = encryption.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
        ext4.create_mount_point("/")
        ext4.mount_point.mount_options = ["acl", "user_xattr"]
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: gpt
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 0.5 GiB
                  start: 1 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: swap
                  file_system: swap
                  mount_point: swap
              - partition:
                  size: 16 GiB
                  start: 513 MiB (0.50 GiB)
                  name: "/dev/sda2"
                  type: primary
                  id: linux
                  file_system: ext4
                  mount_point: "/"
                  fstab_options:
                  - acl
                  - user_xattr
                  encryption:
                    type: LUKS1
                    name: "/dev/mapper/cr_system"
                    password: vry!s3cret
              - free:
                  size: 245247 MiB (239.50 GiB)
                  start: 16897 MiB (16.50 GiB))
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains an lvm setup with encryption on the PV level" do
      before do
        sda = Y2Storage::Disk.create(staging, "/dev/sda")
        sda.size = 256 * Storage.GiB

        ptable = sda.create_partition_table(Y2Storage::PartitionTables::Type::MSDOS)
        blocks = (sda.size.to_i / 512) - 2048

        sda1 = ptable.create_partition("/dev/sda1", Y2Storage::Region.create(2048, blocks, 512),
          Y2Storage::PartitionType::PRIMARY)
        sda1.id = Y2Storage::PartitionId::LVM

        encryption = sda1.create_encryption("cr_sda1")
        encryption.password = "s3cr3t"

        lvm_vg = Y2Storage::LvmVg.create(staging, "system")
        lvm_vg.add_lvm_pv(encryption)

        lvm_lv = lvm_vg.create_lvm_lv("root", 16 * Storage.GiB)
        fs = lvm_lv.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
        fs.create_mount_point("/")
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: msdos
              mbr_gap: 1 MiB
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 262143 MiB (256.00 GiB)
                  start: 1 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: lvm
                  encryption:
                    type: LUKS1
                    name: "/dev/mapper/cr_sda1"
                    password: s3cr3t
          - lvm_vg:
              vg_name: system
              extent_size: 4 MiB
              lvm_lvs:
              - lvm_lv:
                  lv_name: root
                  size: 16 GiB
                  stripes: 1
                  file_system: ext4
                  mount_point: "/"
              lvm_pvs:
              - lvm_pv:
                  blk_device: "/dev/mapper/cr_sda1")
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains an lvm setup with encryption on the LV level" do
      before do
        sda = Y2Storage::Disk.create(staging, "/dev/sda")
        sda.size = 256 * Storage.GiB

        ptable = sda.create_partition_table(Y2Storage::PartitionTables::Type::MSDOS)
        blocks = (sda.size.to_i / 512) - 2048

        sda1 = ptable.create_partition("/dev/sda1", Y2Storage::Region.create(2048, blocks, 512),
          Y2Storage::PartitionType::PRIMARY)
        sda1.id = Y2Storage::PartitionId::LVM

        lvm_vg = Y2Storage::LvmVg.create(staging, "system")
        lvm_vg.add_lvm_pv(sda1)

        lvm_lv = lvm_vg.create_lvm_lv("root", 16 * Storage.GiB)

        encryption = lvm_lv.create_encryption("cr_sda1")
        encryption.password = "s3cr3t"

        fs = encryption.create_filesystem(Y2Storage::Filesystems::Type::XFS)
        fs.create_mount_point("/")
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: msdos
              mbr_gap: 1 MiB
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 262143 MiB (256.00 GiB)
                  start: 1 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: lvm
          - lvm_vg:
              vg_name: system
              extent_size: 4 MiB
              lvm_lvs:
              - lvm_lv:
                  lv_name: root
                  size: 16 GiB
                  stripes: 1
                  file_system: xfs
                  mount_point: "/"
                  encryption:
                    type: LUKS1
                    name: "/dev/mapper/cr_sda1"
                    password: s3cr3t
              lvm_pvs:
              - lvm_pv:
                  blk_device: "/dev/sda1")
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains an encrypted partition setup" do
      before do
        disk = Y2Storage::Disk.create(staging, "/dev/sda")
        disk.size = 256 * Storage.GiB

        fs = disk.create_filesystem(Y2Storage::Filesystems::Type::XFS)
        fs.create_mount_point("/data")
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              file_system: xfs
              mount_point: "/data")
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a filesystem directly on a disk without a " \
            "partition table" do
      before do
        disk = Y2Storage::Disk.create(staging, "/dev/sda")
        disk.size = 256 * Storage.GiB

        encryption = disk.create_encryption("cr_data")
        encryption.password = "s3cr3t"

        fs = encryption.create_filesystem(Y2Storage::Filesystems::Type::XFS)
        fs.create_mount_point("/data")
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              file_system: xfs
              mount_point: "/data"
              encryption:
                type: LUKS1
                name: "/dev/mapper/cr_data"
                password: s3cr3t)
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a zero-size disk" do
      before do
        Y2Storage::Disk.create(staging, "/dev/sda", 0)
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 0 B
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B)
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains objects not yet supported in YAML" do
      before do
        fake_scenario(scenario)
        fs = Y2Storage::Filesystems::Nfs.create(fake_devicegraph, "server", "/path")
        fs.create_mount_point("/nfs_mount")
      end
      let(:scenario) { "empty-dm_raids.xml" }

      let(:expected_result) do
        # Without the irrelevant leading 44 lines
        %(- unsupported_device:
              type: Y2Storage::DmRaid
              name: "/dev/mapper/isw_ddgdcbibhd_test1"
              support: unsupported in YAML - check XML
          - unsupported_device:
              type: Y2Storage::DmRaid
              name: "/dev/mapper/isw_ddgdcbibhd_test2"
              support: unsupported in YAML - check XML
          - unsupported_device:
              type: Y2Storage::Filesystems::Nfs
              name: server:/path
              support: unsupported in YAML - check XML)
      end

      # Select the relevant part of the YAML for this test:
      # Everything from the first line with "-unsupported_device:" on.
      #
      # @param yaml [String]
      # @return [String]
      def relevant_part(yaml)
        lines = yaml.split("\n")
        start_line = lines.index("- unsupported_device:")
        return "" if start_line.nil?

        lines.shift(start_line)
        lines.join("\n")
      end

      it "generates the expected yaml content" do
        described_class.write(fake_devicegraph, io)
        expect(plain_content(relevant_part(io.string))).to eq(plain_content(expected_result))
      end
    end

    context "when recording passwords is disabled" do
      before do
        disk = Y2Storage::Disk.create(staging, "/dev/sda")
        disk.size = 256 * Storage.GiB

        encryption = disk.create_encryption("cr_data")
        encryption.password = "s3cr3t"

        fs = encryption.create_filesystem(Y2Storage::Filesystems::Type::XFS)
        fs.create_mount_point("/data")
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              file_system: xfs
              mount_point: "/data"
              encryption:
                type: LUKS1
                name: "/dev/mapper/cr_data"
                password: "***")
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io, record_passwords: false)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a filesystem directly on a Software RAID" do
      before do
        fake_scenario("formatted_md")
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 500 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: msdos
              mbr_gap: 1 MiB
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 10 GiB
                  start: 1 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: linux
              - partition:
                  size: 10 GiB
                  start: 10241 MiB (10.00 GiB)
                  name: "/dev/sda2"
                  type: primary
                  id: linux
              - free:
                  size: 491519 MiB (480.00 GiB)
                  start: 20481 MiB (20.00 GiB)
          - md:
              name: "/dev/md0"
              md_level: raid0
              md_parity: default
              chunk_size: 16 KiB
              md_uuid: 111-222-333
              in_etc_mdadm: true
              metadata: '1.0'
              file_system: ext4
              label: data
              mount_point: "/data"
              md_devices:
              - md_device:
                  blk_device: "/dev/sda1"
              - md_device:
                  blk_device: "/dev/sda2")
      end

      it "generates the expected yaml content" do
        described_class.write(fake_devicegraph, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a Software RAID with partitions" do
      before do
        fake_scenario("partitioned_md")
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 500 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: msdos
              mbr_gap: 1 MiB
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 10 GiB
                  start: 1 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: linux
              - partition:
                  size: 10 GiB
                  start: 10241 MiB (10.00 GiB)
                  name: "/dev/sda2"
                  type: primary
                  id: linux
              - free:
                  size: 491519 MiB (480.00 GiB)
                  start: 20481 MiB (20.00 GiB)
          - disk:
              name: "/dev/sdb"
              size: 500 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
          - md:
              name: "/dev/md0"
              md_level: raid0
              md_parity: default
              chunk_size: 16 KiB
              md_uuid: ''
              in_etc_mdadm: true
              metadata: ''
              partition_table: msdos
              mbr_gap: 1 MiB
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 1 GiB
                  start: 1 MiB
                  name: "/dev/md0p1"
                  type: primary
                  id: linux
              - free:
                  size: 19637506 KiB (18.73 GiB)
                  start: 1025 MiB (1.00 GiB)
              md_devices:
              - md_device:
                  blk_device: "/dev/sda1"
              - md_device:
                  blk_device: "/dev/sda2")
      end

      it "generates the expected yaml content" do
        described_class.write(fake_devicegraph, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end

    context "when the devicegraph contains a btrfs with a nocow subvolume" do
      before do
        sda = Y2Storage::Disk.create(staging, "/dev/sda")
        sda.size = 1 * Storage.GiB

        btrfs = sda.create_filesystem(Y2Storage::Filesystems::Type::BTRFS)
        btrfs.create_mount_point("/")
        btrfs.create_btrfs_subvolume("/bar", true)
      end

      let(:expected_result) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 1 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              file_system: btrfs
              mount_point: "/"
              btrfs:
                subvolumes:
                - subvolume:
                    path: bar
                    nocow: true)
      end

      it "generates the expected yaml content" do
        described_class.write(staging, io)
        expect(plain_content(io.string)).to eq(plain_content(expected_result))
      end
    end
  end
end
