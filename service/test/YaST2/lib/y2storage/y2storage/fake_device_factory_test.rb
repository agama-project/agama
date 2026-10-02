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
describe Y2Storage::FakeDeviceFactory do
  include_context "yast2-storage-ng test setup"

  describe ".load_yaml_file" do
    before do
      Y2Storage::StorageManager.create_test_instance
    end

    let(:staging) { Y2Storage::StorageManager.instance.probed.to_storage_value }

    let(:io) { StringIO.new(input) }

    context "when yaml contains a simple dasd and partition setup" do
      let(:input) do
        %(---
          - dasd:
              name: "/dev/sda"
              type: eckd
              size: 256 GiB
              block_size: 4 KiB
              partition_table: dasd
              partitions:
              - free:
                  size: 1 MiB
                  start: 0 B
              - partition:
                  size: 0.5 GiB
                  start: 1 MiB
                  name: "/dev/sda1"
                  type: primary
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
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        expect(staging.num_devices).to eq 8
        expect(staging.num_holders).to eq 7

        sda = Storage::Dasd.find_by_name(staging, "/dev/sda")
        expect(sda.type).to eq Y2Storage::DasdType::ECKD.to_i
        expect(sda.size).to eq 256 * Storage.GiB
        expect(sda.region.block_size).to eq 4 * Storage.KiB
        expect(sda.topology.minimal_grain).to eq 4 * Storage.KiB

        sda1 = Storage::Partition.find_by_name(staging, "/dev/sda1")
        expect(sda1.size).to eq 512 * Storage.MiB

        sda2 = Storage::Partition.find_by_name(staging, "/dev/sda2")
        expect(sda2.size).to eq 16 * Storage.GiB
      end
    end

    context "when yaml contains a simple disk and partition setup" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 4 KiB
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
                  mount_by: path
                  fstab_options:
                  - acl
                  - user_xattr
                  mkfs_options: -b 2048
              - free:
                  size: 245247 MiB (239.50 GiB)
                  start: 16897 MiB (16.50 GiB)
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        expect(staging.num_devices).to eq 8
        expect(staging.num_holders).to eq 7

        sda = Storage.to_disk(Storage::BlkDevice.find_by_name(staging, "/dev/sda"))
        expect(sda.size).to eq 256 * Storage.GiB
        expect(sda.region.block_size).to eq 4 * Storage.KiB

        sda1 = Storage.to_partition(Storage::BlkDevice.find_by_name(staging, "/dev/sda1"))
        expect(sda1.size).to eq 512 * Storage.MiB

        sda2 = Storage.to_partition(Storage::BlkDevice.find_by_name(staging, "/dev/sda2"))
        expect(sda2.size).to eq 16 * Storage.GiB
        expect(sda2.filesystem.fstab_options.to_a).to contain_exactly("acl", "user_xattr")
        expect(sda2.filesystem.mkfs_options).to eq("-b 2048")
        expect(sda2.filesystem.mount_by).to eql(Y2Storage::Filesystems::MountByType::PATH.to_i)
      end
    end

    context "when yaml contains a simple lvm setup" do
      let(:input) do
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
              extent_size: 8 MiB
              lvm_lvs:
              - lvm_lv:
                  lv_name: root
                  size: 16 GiB
                  file_system: ext4
                  stripes: 2
                  stripe_size: 8 GiB
                  mount_point: "/"
              lvm_pvs:
              - lvm_pv:
                  blk_device: "/dev/sda"
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        expect(staging.num_devices).to eq 6
        expect(staging.num_holders).to eq 5

        root = Storage.to_lvm_lv(Storage::BlkDevice.find_by_name(staging, "/dev/system/root"))
        expect(root.lv_name).to eq "root"
        expect(root.size).to eq 16 * Storage.GiB

        system = root.lvm_vg
        expect(system.vg_name).to eq "system"
        expect(system.extent_size).to eq 8 * Storage.MiB
        expect(system.lvm_lvs.size).to eq 1
        expect(system.lvm_pvs.size).to eq 1
      end
    end

    context "when yaml contains a simple encryption setup" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 256 GiB
              block_size: 4 KiB
              partition_table: gpt
              partitions:
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
                      type: "luks"
                      name: "/dev/mapper/cr_root"
                      password: "s3cr3t"
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        sda2 = Storage.to_partition(Storage::BlkDevice.find_by_name(staging, "/dev/sda2"))
        encryption = sda2.encryption

        expect(sda2.has_encryption).to be true
        expect(encryption.has_filesystem).to be true

        expect(encryption.password).to eq "s3cr3t"
        expect(encryption.name).to eq "/dev/mapper/cr_root"
        expect(encryption.filesystem.mount_point.path).to eq "/"
      end
    end

    context "when yaml contains an LVM encrypted on the PV level" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 512 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: msdos
              partitions:
              - partition:
                  size: 511 GiB
                  start: 2 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: lvm
                  encryption:
                      type: "luks"
                      name: "/dev/mapper/cr_sda1"
                      password: "s3cr3t"
          - lvm_vg:
              vg_name: system
              lvm_lvs:
              - lvm_lv:
                  lv_name: root
                  size: 100 GiB
                  file_system: xfs
                  mount_point: "/"
              lvm_pvs:
              - lvm_pv:
                  blk_device: "/dev/mapper/cr_sda1"
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        root_lv = Storage.to_lvm_lv(Storage::BlkDevice.find_by_name(staging, "/dev/system/root"))
        sda1 = Storage.to_partition(Storage::BlkDevice.find_by_name(staging, "/dev/sda1"))
        root_fs = root_lv.filesystem
        encryption = sda1.encryption

        expect(sda1.has_encryption).to be true
        expect(root_lv.has_encryption).to be false
        expect(root_lv.has_filesystem).to be true
        expect(encryption.has_filesystem).to be false

        expect(root_fs.mount_point.path).to eq "/"
        expect(encryption.password).to eq "s3cr3t"
        expect(encryption.name).to eq "/dev/mapper/cr_sda1"
      end
    end

    context "when yaml contains an LVM encrypted on the LV level" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 512 GiB
              block_size: 0.5 KiB
              io_size: 0 B
              min_grain: 1 MiB
              align_ofs: 0 B
              partition_table: msdos
              partitions:
              - partition:
                  size: 511 GiB
                  start: 2 MiB
                  name: "/dev/sda1"
                  type: primary
                  id: lvm
          - lvm_vg:
              vg_name: system
              lvm_lvs:
              - lvm_lv:
                  lv_name: root
                  size: 100 GiB
                  file_system: xfs
                  mount_point: "/"
                  encryption:
                      type: "luks"
                      name: "/dev/mapper/cr_root"
                      password: "s3cr3t"
              lvm_pvs:
              - lvm_pv:
                  blk_device: "/dev/sda1"
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        root_lv = Storage.to_lvm_lv(Storage::BlkDevice.find_by_name(staging, "/dev/system/root"))
        sda1 = Storage.to_partition(Storage::BlkDevice.find_by_name(staging, "/dev/sda1"))
        encryption = root_lv.encryption
        root_fs = encryption.filesystem

        expect(sda1.has_encryption).to be false
        expect(root_lv.has_encryption).to be true
        expect(root_lv.has_filesystem).to be false
        expect(encryption.has_filesystem).to be true

        expect(root_fs.mount_point.path).to eq "/"
        expect(encryption.password).to eq "s3cr3t"
        expect(encryption.name).to eq "/dev/mapper/cr_root"
      end
    end

    context "when yaml contains a filesystem directly on the disk without a partition table" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sdb"
              size: 512 GiB
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              uuid: 4711-abcd-0815
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        disk = Storage.to_disk(Storage::BlkDevice.find_by_name(staging, "/dev/sdb"))

        expect(disk.has_filesystem).to be true
        expect(disk.has_partition_table).to be false

        fs = disk.filesystem
        expect(fs.mount_point.path).to eq "/data"
        expect(fs.label).to eq "backup"
        expect(fs.uuid).to eq "4711-abcd-0815"
      end
    end

    context "when yaml contains an encrypted filesystem directly on the disk" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sdb"
              size: 512 GiB
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              encryption:
                  type: "luks"
                  name: "/dev/mapper/cr_data"
                  password: "s3cr3t"
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        disk = Storage.to_disk(Storage::BlkDevice.find_by_name(staging, "/dev/sdb"))

        expect(disk.has_encryption).to be true
        expect(disk.has_filesystem).to be false
        expect(disk.has_partition_table).to be false
        encryption = disk.encryption
        fs = encryption.filesystem

        expect(fs.mount_point.path).to eq "/data"
        expect(fs.label).to eq "backup"
      end
    end

    context "when yaml contains an encrypted device with no device name" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sdb"
              size: 512 GiB
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              encryption:
                  type: "luks"
        )
      end

      it "generates a proper device name with an auto-generated Encryption name" do
        described_class.load_yaml_file(staging, io)

        disk = Storage.to_disk(Storage::BlkDevice.find_by_name(staging, "/dev/sdb"))

        expect(disk.has_encryption).to be true
        expect(disk.encryption.name).to eq "/dev/mapper/cr_data"
      end
    end

    context "when yaml contains an encrypted device with a device name" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sdb"
              size: 512 GiB
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              encryption:
                  type: "luks"
                  name: "/dev/mapper/cr_custom_name"
        )
      end

      it "generates a proper device name using the provided device name" do
        described_class.load_yaml_file(staging, io)

        disk = Storage.to_disk(Storage::BlkDevice.find_by_name(staging, "/dev/sdb"))

        expect(disk.has_encryption).to be true
        expect(disk.encryption.name).to eq "/dev/mapper/cr_custom_name"
      end
    end

    context "when yaml contains an encrypted device with a DeviceMapper name" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sdb"
              size: 512 GiB
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              encryption:
                  type: "luks"
                  name: "cr_dm_name"
        )
      end

      it "generates a proper device name using the provided DeviceMapper name" do
        described_class.load_yaml_file(staging, io)

        disk = Storage.to_disk(Storage::BlkDevice.find_by_name(staging, "/dev/sdb"))

        expect(disk.has_encryption).to be true
        expect(disk.encryption.name).to eq "/dev/mapper/cr_dm_name"
      end
    end

    context "when yaml contains a zero-size disk" do
      before do
        Y2Storage::StorageManager.create_test_instance
      end

      let(:input) do
        %(---
          - disk:
              name: /dev/sda
              size: 0
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(fake_devicegraph, io)

        sda = fake_devicegraph.find_by_name("/dev/sda")

        expect(sda).to_not be_nil
        expect(sda.size).to be_zero
        expect(sda.has_children?).to eq(false)
      end
    end

    context "when yaml contains both, a filesystem and a partition table directly on the disk" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sdb"
              size: 512 GiB
              partition_table: gpt
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              uuid: 4711-abcd-0815
        )
      end

      it "cannot create a devicegraph" do
        err = Y2Storage::AbstractDeviceFactory::HierarchyError
        expect { described_class.load_yaml_file(staging, io) }.to raise_error(err)
      end
    end

    context "when yaml contains a filesystem directly on the Software RAID" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 10 GiB
              partition_table: msdos
              partitions:
              - partition:
                  size: 5 GiB
                  name: "/dev/sda1"
                  type: primary
                  id: raid
              - partition:
                  size: 5 GiB
                  name: "/dev/sda2"
                  type: primary
                  id: raid
          - disk:
              name: "/dev/sdb"
              size: 10 GiB
              block_size: 0.5 KiB
          - md:
              name: "/dev/md0"
              md_level: raid1
              md_parity: first
              chunk_size: 16 KiB
              md_uuid: 111-222-333
              in_etc_mdadm: true
              metadata: "1.0"
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              uuid: 4711-abcd-0815
              md_devices:
              - md_device:
                  blk_device: /dev/sda1
              - md_device:
                  blk_device: /dev/sdb
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        md = Storage.to_md(Storage::BlkDevice.find_by_name(staging, "/dev/md0"))

        expect(md.name).to eq("/dev/md0")
        expect(md.md_level).to eq(Y2Storage::MdLevel::RAID1.to_i)
        expect(md.md_parity).to eq(Y2Storage::MdParity::FIRST.to_i)
        expect(md.chunk_size).to eq(16 * Storage.KiB)
        expect(md.uuid).to eq("111-222-333")
        expect(md.in_etc_mdadm?).to eq(true)
        expect(md.metadata).to eq("1.0")

        expect(md.devices).to_not be_nil
        expect(md.devices.to_a.size).to eq(2)
        expect(md.devices.to_a.map(&:name)).to contain_exactly("/dev/sda1", "/dev/sdb")

        expect(md.has_filesystem).to eq(true)
        expect(md.has_partition_table).to eq(false)

        fs = md.filesystem
        expect(fs.mount_point.path).to eq("/data")
        expect(fs.label).to eq("backup")
        expect(fs.uuid).to eq("4711-abcd-0815")
      end
    end

    context "when yaml contains an encrypted filesystem directly on the Software RAID" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 10 GiB
              partition_table: msdos
              partitions:
              - partition:
                  size: 5 GiB
                  name: "/dev/sda1"
                  type: primary
                  id: raid
              - partition:
                  size: 5 GiB
                  name: "/dev/sda2"
                  type: primary
                  id: raid
          - md:
              name: "/dev/md0"
              file_system: ext4
              mount_point: "/data"
              label: "backup"
              encryption:
                  type: "luks"
                  name: "/dev/mapper/cr_data"
                  password: "s3cr3t"
              md_devices:
              - md_device:
                  blk_device: /dev/sda1
              - md_device:
                  blk_device: /dev/sda2
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        md = Storage.to_md(Storage::BlkDevice.find_by_name(staging, "/dev/md0"))

        expect(md.has_encryption).to eq(true)
        expect(md.has_filesystem).to eq(false)
        expect(md.has_partition_table).to eq(false)

        encryption = md.encryption
        fs = encryption.filesystem

        expect(fs.mount_point.path).to eq("/data")
        expect(fs.label).to eq("backup")
      end
    end

    context "when yaml contains a Software RAID with partitions setup" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 10 GiB
              partition_table: msdos
              partitions:
              - partition:
                  size: 5 GiB
                  name: "/dev/sda1"
                  type: primary
                  id: raid
              - partition:
                  size: 5 GiB
                  name: "/dev/sda2"
                  type: primary
                  id: raid
          - md:
              name: "/dev/md0"
              partition_table: gpt
              partitions:
              - partition:
                  size: 2 GiB
                  name: "/dev/md0-part1"
                  type: primary
              - partition:
                  size: 3 GiB
                  name: "/dev/md0-part2"
                  type: primary
              md_devices:
              - md_device:
                  blk_device: /dev/sda1
              - md_device:
                  blk_device: /dev/sda2
        )
      end

      it "creates the expected devicegraph" do
        described_class.load_yaml_file(staging, io)

        md = Storage.to_md(Storage::BlkDevice.find_by_name(staging, "/dev/md0"))

        expect(md.has_filesystem).to eq(false)
        expect(md.has_partition_table).to eq(true)

        expect(md.partition_table.type).to eq(Storage::PtType_GPT)
        expect(md.partition_table.partitions.to_a.size).to eq(2)
        expect(md.partition_table.partitions.to_a.map(&:name))
          .to contain_exactly("/dev/md0-part1", "/dev/md0-part2")

        part1 = Storage.to_partition(Storage::BlkDevice.find_by_name(staging, "/dev/md0-part1"))
        expect(part1.size).to eq(2 * Storage.GiB)

        part2 = Storage.to_partition(Storage::BlkDevice.find_by_name(staging, "/dev/md0-part2"))
        expect(part2.size).to eq(3 * Storage.GiB)
      end
    end

    context "when yaml contains both, a filesystem and a partition table on the Software RAID" do
      let(:input) do
        %(---
          - disk:
              name: "/dev/sda"
              size: 10 GiB
              partition_table: msdos
              partitions:
              - partition:
                  size: 5 GiB
                  name: "/dev/sda1"
                  type: primary
                  id: raid
              - partition:
                  size: 5 GiB
                  name: "/dev/sda2"
                  type: primary
                  id: raid
          - md:
              name: "/dev/md0"
              file_system: ext4
              partition_table: msdos
              md_devices:
              - md_device:
                  blk_device: /dev/sda1
              - md_device:
                  blk_device: /dev/sda2
        )
      end

      it "cannot create a devicegraph" do
        err = Y2Storage::AbstractDeviceFactory::HierarchyError
        expect { described_class.load_yaml_file(staging, io) }.to raise_error(err)
      end
    end
  end
end
