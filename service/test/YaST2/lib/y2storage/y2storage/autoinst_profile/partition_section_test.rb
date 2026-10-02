#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2019] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"
require_relative "#{TEST_PATH}/support/autoinst_profile_sections_examples"
require "y2storage"

describe Y2Storage::AutoinstProfile::PartitionSection do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:section) { described_class.new }

  let(:scenario) { "autoyast_drive_examples" }

  before { fake_scenario(scenario) }

  include_examples "autoinst section"

  def device(name)
    Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/#{name}")
  end

  describe ".new_from_storage" do
    let(:parent) { double("Installation::AutoinstProfile::SectionWithAttributes") }

    def section_for(name)
      described_class.new_from_storage(device(name))
    end

    it "returns a PartitionSection object" do
      expect(section_for("dasdb1")).to be_a Y2Storage::AutoinstProfile::PartitionSection
    end

    it "sets the parent section" do
      section = described_class.new_from_storage(device("dasdb1"), parent)
      expect(section.parent).to eq(parent)
    end

    context "given a partition" do
      it "correctly initializes #partition_nr" do
        expect(section_for("dasdb1").partition_nr).to eq 1
        expect(section_for("sdc3").partition_nr).to eq 3
      end

      it "initializes #partition_type to 'primary' for primary partitions" do
        expect(section_for("sdd3").partition_type).to eq "primary"
      end

      it "initializes #partition_type to nil for logical partitions" do
        expect(section_for("sdd4").partition_type).to be_nil
      end

      it "initializes #size to the exact device size in bytes" do
        expect(section_for("sdb1").size).to eq Y2Storage::DiskSize.GiB(780).to_i.to_s
      end

      context "when the partition belongs to a LVM volume group" do
        it "initializes the #lvm_group" do
          expect(section_for("sdj1").lvm_group).to eq("vg0")
        end
      end

      context "when the partition belongs to an MD RAID" do
        let(:dev) { device("sdb1") }
        let(:md) { instance_double(Y2Storage::Md, name: "/dev/md0") }

        before do
          allow(dev).to receive(:md).and_return(md)
        end

        it "initializes #raid_name" do
          section = described_class.new_from_storage(dev)
          expect(section.raid_name).to eq(md.name)
        end
      end

      context "when the partition belongs to a multi-device Btrfs" do
        let(:scenario) { "btrfs2-devicegraph.xml" }
        let(:partition) { device("sdb1") }

        it "initializes #btrfs_name" do
          section = described_class.new_from_storage(partition)
          btrfs_name = section.name_for_btrfs(partition.filesystem)

          expect(section.btrfs_name).to_not be_nil
          expect(section.btrfs_name).to eq(btrfs_name)
        end
      end

      context "when the partition table does not have support for extended partitions" do
        let(:dev) { device("sdh") }

        it "does not include the partition_type" do
          expect(section_for("sdh1").partition_type).to be_nil
        end
      end

      context "when the partition is a backing device for a bcache" do
        let(:scenario) { "btrfs_bcache.xml" }
        let(:dev) { device("vdb") }

        it "initializes #bcache_backing_for" do
          section = described_class.new_from_storage(dev)
          expect(section.bcache_backing_for).to eq("/dev/bcache0")
        end
      end

      context "when the partition is a caching device for a bcache" do
        let(:scenario) { "btrfs_bcache.xml" }
        let(:dev) { device("vda3") }

        it "initializes #bcache_caching_for" do
          section = described_class.new_from_storage(dev)
          expect(section.bcache_caching_for).to eq(["/dev/bcache0"])
        end
      end
    end

    context "given a disk" do
      let(:dev) { device("sda") }

      let(:section) { described_class.new_from_storage(dev) }

      it "initializes #create to false" do
        expect(section.create).to eq(false)
      end

      it "initializes #size to nil" do
        expect(section.size).to be_nil
      end

      context "when the disk belongs to a LVM volume group" do
        let(:pv) { instance_double(Y2Storage::LvmPv, lvm_vg: vg) }
        let(:vg) { instance_double(Y2Storage::LvmVg, basename: "vg0") }

        before do
          allow(dev).to receive(:lvm_pv).and_return(pv)
        end

        it "initializes the #lvm_group" do
          expect(section.lvm_group).to eq("vg0")
        end
      end

      context "when the disk belongs to an MD RAID" do
        let(:md) { instance_double(Y2Storage::Md, name: "/dev/md0") }

        before do
          allow(dev).to receive(:md).and_return(md)
        end

        it "initializes #raid_name" do
          section = described_class.new_from_storage(dev)
          expect(section.raid_name).to eq(md.name)
        end
      end

      context "when the disk belongs to a multi-device Btrfs" do
        before do
          sdd3 = device("sdd3")
          dev.remove_descendants
          sdd3.filesystem.add_device(dev)
        end

        it "initializes #btrfs_name" do
          btrfs_name = section.name_for_btrfs(dev.filesystem)

          expect(section.btrfs_name).to_not be_nil
          expect(section.btrfs_name).to eq(btrfs_name)
        end
      end
    end

    context "given a logical volume" do
      let(:scenario) { "lvm-striped-lvs" }

      let(:vg) { fake_devicegraph.lvm_vgs.first }

      before do
        # FIXME: add support to the fake factory for LVM thin pools
        thin_pool_lv = vg.create_lvm_lv("pool0", Y2Storage::LvType::THIN_POOL, 20.GiB)
        thin_lv = thin_pool_lv.create_lvm_lv("data", Y2Storage::LvType::THIN, 20.GiB)
        thin_lv.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
      end

      it "initializes the #lv_name" do
        expect(section_for("vg0/lv1").lv_name).to eq("lv1")
      end

      it "initializes stripes related properties" do
        expect(section_for("vg0/lv1").stripes).to eq(2)
        expect(section_for("vg0/lv1").stripe_size).to eq(4)
      end

      it "initializes pool to false" do
        expect(section_for("vg0/lv1").pool).to eq(false)
      end

      context "and it is a thin pool" do
        it "initializes pool to true" do
          expect(section_for("vg0/pool0").pool).to eq(true)
        end
      end

      context "and it is a thin volume" do
        it "initializes used_pool with the pool's name" do
          expect(section_for("vg0/data").used_pool).to eq("pool0")
        end
      end

      context "when the LV belongs to a multi-device Btrfs" do
        let(:scenario) { "autoyast_drive_examples" }

        let(:dev) { device("vg0/lv1") }

        let(:section) { described_class.new_from_storage(dev) }

        before do
          sdd3 = device("sdd3")
          dev.remove_descendants
          sdd3.filesystem.add_device(dev)
        end

        it "initializes #btrfs_name" do
          btrfs_name = section.name_for_btrfs(dev.filesystem)

          expect(section.btrfs_name).to_not be_nil
          expect(section.btrfs_name).to eq(btrfs_name)
        end
      end
    end

    context "given an MD RAID" do
      context "when it is used as an LVM physical volume" do
        let(:raid_options) { instance_double(Y2Storage::AutoinstProfile::RaidOptionsSection) }

        let(:md) do
          instance_double(
            Y2Storage::Md,
            numeric?:       numeric?,
            number:         0,
            encrypted?:     false,
            filesystem:     filesystem,
            lvm_pv:         lvm_pv,
            bcache:         nil,
            in_bcache_cset: nil
          )
        end

        let(:filesystem) do
          instance_double(
            Y2Storage::Filesystems::Btrfs,
            type:                       Y2Storage::Filesystems::Type::BTRFS,
            label:                      "",
            mkfs_options:               "",
            supports_btrfs_subvolumes?: false,
            mount_point:                nil,
            sid:                        10000,
            multidevice?:               false
          )
        end

        let(:numeric?) { true }
        let(:lvm_pv) { nil }

        before do
          allow(md).to receive(:is?) { |*t| t.include?(:software_raid) }
          allow(Y2Storage::AutoinstProfile::RaidOptionsSection).to receive(:new_from_storage)
            .and_return(raid_options)
          allow(filesystem).to receive(:is?).with(:btrfs).and_return(true)
        end

        let(:lvm_vg) { instance_double(Y2Storage::LvmVg, basename: "vg0") }
        let(:lvm_pv) do
          instance_double(
            Y2Storage::LvmPv,
            lvm_vg: lvm_vg
          )
        end

        it "initializes #lvm_group" do
          section = described_class.new_from_storage(md)
          expect(section.lvm_group).to eq("vg0")
        end

        context "but it does not belong to any volume group" do
          let(:lvm_vg) { nil }

          it "does not initialize #lvm_group" do
            section = described_class.new_from_storage(md)
            expect(section.lvm_group).to be_nil
          end
        end
      end

      context "when the MD RAID belongs to a multi-device Btrfs" do
        let(:scenario) { "autoyast_drive_examples" }

        let(:dev) { Y2Storage::Md.create(fake_devicegraph, "/dev/md0") }

        let(:section) { described_class.new_from_storage(dev) }

        before do
          sdd3 = device("sdd3")
          sdd3.filesystem.add_device(dev)
        end

        it "initializes #btrfs_name" do
          btrfs_name = section.name_for_btrfs(dev.filesystem)

          expect(section.btrfs_name).to_not be_nil
          expect(section.btrfs_name).to eq(btrfs_name)
        end
      end
    end

    context "given a NFS filesystem" do
      let(:scenario) { "nfs1.xml" }

      let(:nfs) do
        Y2Storage::Filesystems::Nfs.find_by_server_and_path(fake_devicegraph, "srv", "/home/a")
      end

      subject(:section) { described_class.new_from_storage(nfs) }

      it "initializes #create to false" do
        expect(section.create).to eq(false)
      end

      it "initializes #size to nil" do
        expect(section.size).to be_nil
      end

      context "if the NFS has mount point" do
        before do
          nfs.mount_point.mount_options = ["rw"]
        end

        it "initializes #mount" do
          expect(section.mount).to eq("/test1")
        end

        it "initializes #mountby" do
          expect(section.mountby).to eq(:device)
        end

        it "initializes #fstab_options" do
          expect(section.fstab_options).to contain_exactly("rw")
        end
      end

      context "if the NFS has no mount point" do
        before do
          nfs.remove_mount_point
        end

        it "initializes #mount to nil" do
          expect(section.mount).to be_nil
        end

        it "initializes #mountby to nil" do
          expect(section.mountby).to be_nil
        end

        it "initializes #fstab_options to nil" do
          expect(section.fstab_options).to be_nil
        end
      end
    end

    shared_examples "filesystem attributes" do
      it "initializes filesystem with the filesystem type" do
        expect(section.filesystem).to eq(filesystem.type.to_sym)
      end

      # See bug#1148477
      it "does not initialize the uuid" do
        expect(section.uuid).to be_nil
      end

      context "when the filesystem has a label" do
        before do
          filesystem.label = "myfs"
        end

        it "initializes label with the filesystem label" do
          expect(section.label).to eq("myfs")
        end
      end

      context "when the filesystem has no label" do
        before do
          filesystem.label = ""
        end

        it "initializes label to nil" do
          expect(section.label).to be_nil
        end
      end

      context "when the filesystem has mkfs options" do
        before do
          filesystem.mkfs_options = "-b 2048"
        end

        it "initializes mkfs_options with the proper value" do
          expect(section.mkfs_options).to eq("-b 2048")
        end
      end

      context "when the filesystem has no mkfs options" do
        before do
          filesystem.mkfs_options = ""
        end

        it "initializes mkfs_options to nil" do
          expect(section.mkfs_options).to be_nil
        end
      end

      context "when the filesystem contains a mount point" do
        before do
          filesystem.mount_path = "/"
          filesystem.mount_point.mount_by = Y2Storage::Filesystems::MountByType::DEVICE
        end

        it "initializes mount with the mount path" do
          expect(section.mount).to eq("/")
        end

        it "initializes mountby with the proper value" do
          expect(section.mountby).to eq(:device)
        end

        context "and the filesystem contains mount options" do
          before do
            filesystem.mount_point.mount_options = ["ro", "acl"]
          end

          it "initializes fstab_options with the proper values" do
            expect(section.fstab_options).to contain_exactly("ro", "acl")
          end
        end

        context "and the filesystem does not contain mount options" do
          before do
            filesystem.mount_point.mount_options = []
          end

          it "initializes fstab_options to nil" do
            expect(section.fstab_options).to be_nil
          end
        end
      end

      context "when the filesystem does not contain a mount point" do
        before do
          filesystem.remove_mount_point if filesystem.mount_point
        end

        it "initializes mount to nil" do
          expect(section.mount).to be_nil
        end

        it "initializes mountby to nil" do
          expect(section.mountby).to be_nil
        end

        it "initializes fstab_options to nil" do
          expect(section.fstab_options).to be_nil
        end
      end
    end

    shared_examples "btrfs attributes" do
      before do
        allow(filesystem).to receive(:subvolumes_prefix).and_return("@")
      end

      it "initializes subvolumes_prefix" do
        expect(section.subvolumes_prefix).to eq("@")
      end

      context "and there are subvolumes" do
        it "initializes subvolumes with the subvolumes specifications" do
          expect(section.subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        end
      end

      context "and there are no subvolumes" do
        before do
          allow(filesystem).to receive(:btrfs_subvolumes).and_return([])
        end

        it "initializes subvolumes as empty" do
          expect(section.subvolumes).to be_empty
        end
      end

      context "and there are subvolumes for snapshots" do
        before do
          filesystem.create_btrfs_subvolume("@/.snapshots", false)
        end

        it "ignores subvolumes for snapshots" do
          expect(section.subvolumes)
            .to_not include(an_object_having_attributes(path: "@/.snapshots"))
        end

        context "and the subvolumes prefix is empty" do
          before do
            allow(filesystem).to receive(:subvolumes_prefix).and_return("")

            filesystem.create_btrfs_subvolume(".snapshots", false)
          end

          it "ignores subvolumes for snapshots" do
            expect(section.subvolumes)
              .to_not include(an_object_having_attributes(path: ".snapshots"))
          end
        end
      end

      context "and quotas are enabled" do
        before do
          allow(filesystem).to receive(:quota?).and_return(true)
        end

        it "initializes the 'quotas' attribute to 'true'" do
          expect(section.quotas).to eq(true)
        end
      end

      context "and quotas are disabled" do
        it "initializes the 'quotas' attribute to 'false'" do
          expect(section.quotas).to eq(false)
        end
      end
    end

    context "given a block filesystem" do
      let(:scenario) { "btrfs2-devicegraph.xml" }

      let(:filesystem) { device("sdb1").filesystem }

      subject(:section) { described_class.new_from_storage(filesystem) }

      include_examples "filesystem attributes"

      context "when the filesystem is Btrfs" do
        include_examples "btrfs attributes"
      end
    end

    context "given a tmpfs" do
      let(:scenario) { "tmpfs1-devicegraph.xml" }

      let(:dev) do
        fake_devicegraph.tmp_filesystems.find { |d| d.mount_path == "/test1" }
      end

      subject(:section) { described_class.new_from_storage(dev) }

      it "initializes #create and #resize to nil" do
        expect(section.create).to be_nil
        expect(section.resize).to be_nil
      end

      it "initializes mount options except the mountby attribute" do
        expect(section.mount).to eq(dev.mount_path)
        expect(section.mountby).to be_nil
        expect(section.fstab_options).to eq(dev.mount_options)
      end
    end

    context "given a partition which is part of a Btrfs multidevice" do
      let(:scenario) { "btrfs2-devicegraph.xml" }

      it "includes the Btrfs name" do
        expect(section_for("sdd1").btrfs_name).to eq("btrfs_63")
      end

      it "does not include filesystem attributes" do
        section = section_for("sdd1")
        expect(section.filesystem).to be_nil
        expect(section.mkfs_options).to be_nil
        expect(section.fstab_options).to be_nil
      end
    end

    context "if the device is formatted" do
      it "initializes #format to true for most partition ids" do
        expect(section_for("nvme0n1p1").format).to eq true
        expect(section_for("nvme0n1p4").format).to eq true
      end

      # Weird logic inherited from the old code
      it "initializes #format to false for PReP and DOS16 partitions" do
        expect(section_for("nvme0n1p2").format).to eq false
        expect(section_for("nvme0n1p3").format).to eq false
      end

      let(:filesystem) { device("sdb1").filesystem }

      subject(:section) { described_class.new_from_storage(filesystem) }

      include_examples "filesystem attributes"

      context "when the filesystem is Btrfs" do
        let(:filesystem) { device("sdd3").filesystem }

        include_examples "btrfs attributes"
      end
    end

    context "if the device is not formatted" do
      before { allow_any_instance_of(Y2Storage::Partition).to receive(:filesystem).and_return nil }

      it "initializes #filesystem, #label, #mount, #mountby, #fstab_options and #mkfs_options to " \
         "nil" do
        expect(section_for("sdc3").filesystem).to be_nil
        expect(section_for("sdc3").label).to be_nil
        expect(section_for("sdc3").mount).to be_nil
        expect(section_for("sdc3").mountby).to be_nil
        expect(section_for("sdc3").fstab_options).to be_nil
        expect(section_for("sdc3").mkfs_options).to be_nil
      end

      it "initializes #format to false despite the partition id" do
        expect(section_for("nvme0n1p1").format).to eq false
        expect(section_for("nvme0n1p2").format).to eq false
        expect(section_for("nvme0n1p3").format).to eq false
        expect(section_for("nvme0n1p4").format).to eq false
      end
    end

    context "if the partition is encrypted" do
      context "and the encryption method requires a password" do
        it "initializes #crypt_key to a generic string" do
          expect(section_for("sdf7").crypt_key).to eq "ENTER KEY HERE"
        end
      end

      context "and the encryption method does not require a password" do
        let(:scenario) { "encrypted_random_swap.xml" }

        it "does not initialize #crypt_key" do
          expect(section_for("vda3").crypt_key).to be_nil
        end
      end

      context "and the encryption method is unknown" do
        before do
          allow_any_instance_of(Y2Storage::Encryption).to receive(:method).and_return(nil)
        end

        it "initializes #crypt_method to 'luks1'" do
          section = section_for("sdf7")
          expect(section.crypt_method).to eq(:luks1)
        end

        it "initializes #crypt_key to a generic string" do
          expect(section_for("sdf7").crypt_key).to eq("ENTER KEY HERE")
        end

        it "initializes #loop_fs to true" do
          section = section_for("sdf7")
          expect(section.loop_fs).to eq true
        end
      end

      it "initializes #loop_fs to true" do
        section = section_for("sdf7")
        expect(section.loop_fs).to eq true
      end

      it "initializes #crypt_method to the encryption method" do
        section = section_for("sdf7")
        expect(section.crypt_method).to eq(:luks1)
      end

      context "and the encryption method supports LUKS label" do
        before do
          partition = device("sdf7")
          partition.encrypt(method: Y2Storage::EncryptionMethod::LUKS2)
        end

        let(:encryption) { device("sdf7").encryption }

        context "but the label is unknown" do
          it "does not initialize #crypt_label" do
            expect(section_for("sdf7").crypt_label).to be_nil
          end
        end

        context "but there is no label" do
          before { encryption.label = "" }

          it "does not initialize #crypt_label" do
            expect(section_for("sdf7").crypt_label).to be_nil
          end
        end

        context "and the LUKS device has a label" do
          before { encryption.label = "some_label" }

          it "initializes #crypt_label with the label" do
            expect(section_for("sdf7").crypt_label).to eq "some_label"
          end
        end
      end

      context "and the encryption method does not support LUKS labels" do
        before do
          partition = device("sdf7")
          partition.encryption.label = "some_label"
        end

        it "does not initialize #crypt_label" do
          expect(section_for("sdf7").crypt_label).to be_nil
        end
      end

      context "and the encryption method supports setting the PBKDF" do
        before do
          partition = device("sdf7")
          partition.encrypt(method: Y2Storage::EncryptionMethod::LUKS2)
        end

        let(:encryption) { device("sdf7").encryption }

        context "but the PBKDF is unknown" do
          it "does not initialize #crypt_pbkdf" do
            expect(section_for("sdf7").crypt_pbkdf).to be_nil
          end
        end

        context "and the PBKDF has a value" do
          before { encryption.pbkdf = Y2Storage::PbkdFunction.find(:argon2id) }

          it "initializes #crypt_pbkdf with the proper value" do
            expect(section_for("sdf7").crypt_pbkdf).to eq :argon2id
          end
        end
      end

      context "and the encryption method does not support setting a PBKDF" do
        before do
          partition = device("sdf7")
          partition.encryption.pbkdf = Y2Storage::PbkdFunction.find(:pbkdf2)
        end

        it "does not initialize #crypt_pbkdf" do
          expect(section_for("sdf7").crypt_pbkdf).to be_nil
        end
      end

      context "and the encryption method supports setting the cipher and key size" do
        let(:encryption) { device("sdf7").encryption }

        context "but the cipher and key size are unknown" do
          it "does not initialize #crypt_cipher or #crypt_key_size" do
            expect(section_for("sdf7").crypt_cipher).to be_nil
            expect(section_for("sdf7").crypt_key_size).to be_nil
          end
        end

        context "and the cipher and key size are known" do
          before do
            encryption.key_size = 64
            encryption.cipher = "aes-xts-plain"
          end

          it "initializes #crypt_key_size with the key size in bits" do
            expect(section_for("sdf7").crypt_key_size).to eq 512
          end

          it "initializes #crypt_cipher with the name of the cipher" do
            expect(section_for("sdf7").crypt_cipher).to eq "aes-xts-plain"
          end
        end
      end

      context "and the encryption method does not support cipher or key size" do
        before do
          partition = device("sdf7")
          encryption = partition.encrypt(method: Y2Storage::EncryptionMethod::RANDOM_SWAP)
          encryption.key_size = 64
          encryption.cipher = "aes-xts-plain"
        end

        it "does not initialize #crypt_cipher or #crypt_key_size" do
          expect(section_for("sdf7").crypt_cipher).to be_nil
          expect(section_for("sdf7").crypt_key_size).to be_nil
        end
      end
    end

    context "if the partition is not encrypted" do
      # Legacy behavior, use the same string we have always used
      it "initializes #crypt_key to a generic string" do
        expect(section_for("sdf7").crypt_key).to eq "ENTER KEY HERE"
      end

      it "initializes #loop_fs, #crypt_method and #crypt_key to nil" do
        section = section_for("sdf6")
        expect(section.loop_fs).to be_nil
        expect(section.crypt_method).to be_nil
        expect(section.crypt_key).to be_nil
      end
    end

    context "if the partition has a typical Windows id" do
      let(:dev) { device("sdb1") }
      let(:mountpoint) { nil }

      before do
        # SWIG makes very hard to use proper mocking here with
        # allow(dev.filesystem).to(receive(:y)) because you can get different
        # Ruby wrapper objects for the same C++ filesystem. So let's simply
        # assign the values instead of intercepting the query calls.
        dev.filesystem.mount_path = mountpoint if mountpoint
      end

      # Weird legacy behavior
      context "and it's configured to be mounted under /boot" do
        let(:mountpoint) { "/boot" }

        it "initializes #partition_id to 263 (legacy id for BIOS BOOT)" do
          section = described_class.new_from_storage(dev)
          expect(section.partition_id).to eq 263
        end
      end

      context "and it's not configured to be mounted under /boot" do
        let(:mountpoint) { nil }

        it "initializes #partition_id with the corresponding legacy number" do
          section = described_class.new_from_storage(dev)
          expect(section.partition_id).to eq 7
        end
      end
    end

    context "if the partition has a non-Windows id " do
      it "initializes #partition_id with the corresponding legacy number" do
        # Legacy (and also current) value for Linux
        expect(section_for("sdh1").partition_id).to eq 131
        # Legacy value for bios_boot (current is 257)
        expect(section_for("sdh2").partition_id).to eq 263
      end
    end

    it "initializes resize to false" do
      expect(section_for("sdh1").resize).to eq(false)
    end
  end

  describe ".new_from_hashes" do
    let(:hash) { { "filesystem" => :ntfs, "label" => "", "partition_id" => 7 } }

    it "returns a PartitionSection object" do
      expect(described_class.new_from_hashes(hash))
        .to be_a Y2Storage::AutoinstProfile::PartitionSection
    end

    it "initializes scalars like #filesystem or #partition_id to their values in the array" do
      section = described_class.new_from_hashes(hash)
      expect(section.filesystem).to eq :ntfs
      expect(section.partition_id).to eq 7
    end

    it "initializes scalars not present in the hash to nil" do
      section = described_class.new_from_hashes(hash)
      expect(section.create).to be_nil
    end

    it "initializes empty scalars to nil" do
      section = described_class.new_from_hashes(hash)
      expect(section.label).to be_nil
    end

    context "when #subvolumes_prefix is set to an empty string" do
      let(:hash) { { "filesystem" => :btrfs, "subvolumes_prefix" => "" } }

      it "initializes #subvolumes_prefix to an empty string" do
        section = described_class.new_from_hashes(hash)
        expect(section.subvolumes_prefix).to eq("")
      end
    end

    context "when #create_subvolumes is not set" do
      it "initializes #create_subvolumes to true" do
        section = described_class.new_from_hashes(hash)
        expect(section.create_subvolumes).to eq(true)
      end
    end

    context "when subvolumes are not present in the hash" do
      it "initializes #subvolumes to nil" do
        section = described_class.new_from_hashes(hash)
        expect(section.subvolumes).to be_nil
      end
    end

    context "when subvolumes are specified in the detailed format" do
      let(:hash) do
        {
          "subvolumes" => [
            { "path" => "var/lib/psql", "copy_on_write" => false },
            { "path" => "srv" }
          ]
        }
      end

      it "initializes #subvolumes to the corresponding array of SubvolSpecification objects" do
        subvolumes = described_class.new_from_hashes(hash).subvolumes
        expect(subvolumes).to be_an(Array)
        expect(subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        expect(subvolumes).to contain_exactly(
          an_object_having_attributes(path: "var/lib/psql", copy_on_write: false),
          an_object_having_attributes(path: "srv", copy_on_write: true)
        )
      end
    end

    context "when subvolumes are specified as a list of paths" do
      let(:hash) { { "subvolumes" => ["var/lib/psql", "srv"] } }

      it "initializes #subvolumes to the corresponding array of SubvolSpecification objects" do
        subvolumes = described_class.new_from_hashes(hash).subvolumes
        expect(subvolumes).to be_an(Array)
        expect(subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        expect(subvolumes).to contain_exactly(
          an_object_having_attributes(path: "var/lib/psql", copy_on_write: true),
          an_object_having_attributes(path: "srv", copy_on_write: true)
        )
      end
    end

    context "when subvolumes are specified as a mix of paths and detailed information" do
      let(:hash) { { "subvolumes" => ["var", { "path" => "srv", "copy_on_write" => false }] } }

      it "initializes #subvolumes to the corresponding array of SubvolSpecification objects" do
        subvolumes = described_class.new_from_hashes(hash).subvolumes
        expect(subvolumes).to be_an(Array)
        expect(subvolumes).to all(be_a(Y2Storage::SubvolSpecification))
        expect(subvolumes).to contain_exactly(
          an_object_having_attributes(path: "var", copy_on_write: true),
          an_object_having_attributes(path: "srv", copy_on_write: false)
        )
      end
    end

    context "when the '@' subvolume is present" do
      let(:hash) { { "subvolumes" => ["@", "srv"] } }

      it "filters out the '@' subvolume" do
        subvolumes = described_class.new_from_hashes(hash).subvolumes
        expect(subvolumes).to contain_exactly(
          an_object_having_attributes(path: "srv", copy_on_write: true)
        )
      end
    end

    context "when raid_options are not present" do
      it "initializes raid_options to nil" do
        section = described_class.new_from_hashes(hash)
        expect(section.raid_options).to be_nil
      end
    end

    context "when raid_options are present" do
      let(:hash) { { "raid_options" => { "chunk_size" => "1M" } } }

      it "initalizes raid_options" do
        section = described_class.new_from_hashes(hash)
        expect(section.raid_options).to be_a(Y2Storage::AutoinstProfile::RaidOptionsSection)
        expect(section.raid_options.chunk_size).to eq("1M")
      end
    end

    context "when fstopt is present" do
      let(:hash) { { "fstopt" => "ro, acl" } }

      it "initializes fstab_options" do
        section = described_class.new_from_hashes(hash)
        expect(section.fstab_options).to eq(["ro", "acl"])
      end
    end

    context "when bcache_caching_for is present" do
      let(:hash) { { "bcache_caching_for" => ["/dev/bcache0"] } }

      it "initializes bcache caching devices list" do
        section = described_class.new_from_hashes(hash)
        expect(section.bcache_caching_for).to eq(["/dev/bcache0"])
      end
    end

    context "when bcache_caching_for is not present" do
      let(:hash) { { "create" => true } }

      it "initializes bcache caching devices list to an empty array" do
        section = described_class.new_from_hashes(hash)
        expect(section.bcache_caching_for).to eq([])
      end
    end

    context "when device is present" do
      let(:hash) { { "device" => nfs_share } }

      let(:nfs_share) { "192.168.56.1:/root" }

      it "initializes device" do
        section = described_class.new_from_hashes(hash)
        expect(section.device).to eq(nfs_share)
      end
    end

    context "when device is not present" do
      let(:hash) { {} }

      it "initializes device to nil" do
        section = described_class.new_from_hashes(hash)
        expect(section.device).to be_nil
      end
    end

    context "when btrfs_name is present" do
      let(:hash) { { "btrfs_name" => btrfs_name } }

      let(:btrfs_name) { "root_fs" }

      it "initializes btrfs_name" do
        section = described_class.new_from_hashes(hash)
        expect(section.btrfs_name).to eq(btrfs_name)
      end
    end

    context "when btrfs_name is not present" do
      let(:hash) { {} }

      it "initializes btrfs_name to nil" do
        section = described_class.new_from_hashes(hash)
        expect(section.btrfs_name).to be_nil
      end
    end
  end

  describe "#to_hashes" do
    subject(:section) { described_class.new }

    it "returns a hash with all the non-blank values using strings as keys" do
      section.filesystem = :btrfs
      section.create = true
      expect(section.to_hashes).to eq("filesystem" => :btrfs, "create" => true)
    end

    it "returns an empty hash if all the values are blank" do
      expect(section.to_hashes).to eq({})
    end

    context "when subvolumes are not supported" do
      before do
        section.filesystem = :btrfs
        section.subvolumes = nil
      end

      it "does not export #subvolumes" do
        expect(section.to_hashes.keys).to_not include "subvolumes"
      end

      it "does not export #create_subvolumes" do
        expect(section.to_hashes.keys).to_not include "create_subvolumes"
      end
    end

    context "when some subvolume exist" do
      before do
        section.subvolumes = [
          Y2Storage::SubvolSpecification.new("@/var/log", copy_on_write: true)
        ]
      end

      it "exports subvolumes as an array of hashes" do
        expect(section.to_hashes["subvolumes"]).to eq(
          [{ "path" => "@/var/log", "copy_on_write" => true }]
        )
      end

      it "exports create_subvolumes as true" do
        expect(section.to_hashes["create_subvolumes"]).to eq(true)
      end

      context "when there is no default subvolume" do
        before do
          section.subvolumes_prefix = ""
        end

        it "exports the default subvolume as an empty string" do
          expect(section.to_hashes["subvolumes_prefix"]).to eq("")
        end
      end

      context "when a default subvolume was specified" do
        before do
          section.subvolumes_prefix = "@"
        end

        it "removes default subvolume from path" do
          expect(section.to_hashes["subvolumes"]).to eq(
            [{ "path" => "var/log", "copy_on_write" => true }]
          )
        end

        it "exports default btrfs subvolume name" do
          expect(section.to_hashes["subvolumes_prefix"]).to eq("@")
        end

      end

      context "when a subvolume has a referenced limit" do
        before do
          section.subvolumes = [
            Y2Storage::SubvolSpecification.new(
              "@/usr", copy_on_write: true, referenced_limit: Y2Storage::DiskSize.new("5 GiB")
            )
          ]
        end

        it "exports subvolumes as an array of hashes" do
          expect(section.to_hashes["subvolumes"]).to include(
            a_hash_including("referenced_limit" => "5 GiB")
          )
        end
      end
    end

    context "when there are not subvolumes" do
      before do
        section.subvolumes = []
      end

      it "exports create_subvolumes as false" do
        expect(section.to_hashes["create_subvolumes"]).to eq(false)
      end
    end

    it "does not export fstab options if it is empty" do
      section.fstab_options = []
      expect(section.to_hashes.keys).to_not include("fstab_options")
    end

    it "exports fstab_options as a string if they are present" do
      section.fstab_options = ["ro", "acl"]
      expect(section.to_hashes["fstopt"]).to eq("ro,acl")
    end
  end

  describe "#type_for_filesystem" do
    subject(:section) { described_class.new }

    it "returns nil if #filesystem is not set" do
      section.filesystem = nil
      expect(subject.type_for_filesystem).to be_nil
    end

    it "returns a Filesystems::Type corresponding to the symbol at #filesystem" do
      section.filesystem = :swap
      expect(subject.type_for_filesystem).to eq Y2Storage::Filesystems::Type::SWAP
      section.filesystem = :btrfs
      expect(subject.type_for_filesystem).to eq Y2Storage::Filesystems::Type::BTRFS
    end

    it "returns nil for unknown values of #filesystem" do
      section.filesystem = :strange
      expect(subject.type_for_filesystem).to be_nil
    end
  end

  describe "#type_for_mountby" do
    subject(:section) { described_class.new }

    it "returns nil if #mountby is not set" do
      section.mountby = nil
      expect(subject.type_for_mountby).to be_nil
    end

    it "returns a Filesystems::Type corresponding to the symbol at #filesystem" do
      section.mountby = :uuid
      expect(subject.type_for_mountby).to eq Y2Storage::Filesystems::MountByType::UUID
      section.mountby = :device
      expect(subject.type_for_mountby).to eq Y2Storage::Filesystems::MountByType::DEVICE
    end

    it "returns nil for unknown values of #filesystem" do
      section.filesystem = :strange
      expect(subject.type_for_filesystem).to be_nil
    end
  end

  describe "#id_for_partition" do
    subject(:section) { described_class.new }

    before { section.partition_id = partition_id }

    context "if #partition_id is set" do
      context "to a legacy integer value" do
        let(:partition_id) { 263 }

        it "returns the corresponding PartitionId object" do
          expect(section.id_for_partition).to eq Y2Storage::PartitionId::BIOS_BOOT
        end
      end

      context "to a standard integer value" do
        let(:partition_id) { 7 }

        it "returns the corresponding PartitionId object" do
          expect(section.id_for_partition).to eq Y2Storage::PartitionId::NTFS
        end
      end
    end

    context "if #partition_id is not set" do
      let(:partition_id) { nil }

      it "returns PartitionId:SWAP if #filesystem is :swap" do
        section.filesystem = :swap
        expect(section.id_for_partition).to eq Y2Storage::PartitionId::SWAP
      end

      it "returns PartitionId::LINUX for any other #filesystem value" do
        section.filesystem = :btrfs
        expect(section.id_for_partition).to eq Y2Storage::PartitionId::LINUX
        section.filesystem = :ntfs
        expect(section.id_for_partition).to eq Y2Storage::PartitionId::LINUX
        section.filesystem = nil
        expect(section.id_for_partition).to eq Y2Storage::PartitionId::LINUX
      end
    end
  end

  describe "#name_for_md" do
    let(:partition) { Y2Storage::AutoinstProfile::PartitionSection.new }

    before do
      section.partition_nr = 3
    end

    # Let's ensure DriveSection#raid_name (which has the same name but
    # completely different meaning) has no influence in the result
    context "if #raid_name (attribute directly in the partition) has value" do
      before { partition.raid_name = "/dev/md25" }

      context "if there is no <raid_options> section" do
        it "returns a name based on partition_nr" do
          expect(section.name_for_md).to eq "/dev/md/3"
        end
      end

      context "if there is a <raid_options> section" do
        let(:raid_options) { Y2Storage::AutoinstProfile::RaidOptionsSection.new }
        before { section.raid_options = raid_options }

        context "if <raid_options> contains an nil raid_name attribute" do
          it "returns a name based on partition_nr" do
            expect(section.name_for_md).to eq "/dev/md/3"
          end
        end

        context "if <raid_options> contains an empty raid_name attribute" do
          before { raid_options.raid_name = "" }

          it "returns a name based on partition_nr" do
            expect(section.name_for_md).to eq "/dev/md/3"
          end
        end

        context "if <raid_options> contains an non-empty raid_name attribute" do
          before { raid_options.raid_name = "/dev/md6" }

          it "returns the name specified in <raid_options>" do
            expect(section.name_for_md).to eq "/dev/md6"
          end
        end
      end
    end

    context "if #raid_name (attribute directly in the partition) is nil" do
      context "if there is no <raid_options> section" do
        it "returns a name based on partition_nr" do
          expect(section.name_for_md).to eq "/dev/md/3"
        end
      end

      # Same logic than above, there is no need to return all the possible
      # sub-contexts
      context "if there is a <raid_options> section with a raid name" do
        let(:raid_options) { Y2Storage::AutoinstProfile::RaidOptionsSection.new }
        before do
          section.raid_options = raid_options
          raid_options.raid_name = "/dev/md7"
        end

        it "returns a name based in <raid_options>" do
          expect(section.name_for_md).to eq "/dev/md7"
        end
      end
    end
  end

  describe "#name_for_btrfs" do
    subject(:section) { described_class.new }

    context "when the filesystem is not a multi-device Btrfs" do
      let(:filesystem) { device("sdd3").filesystem }

      it "returns nil" do
        expect(section.name_for_btrfs(filesystem)).to be_nil
      end
    end

    context "when the filesystem is a multi-device Btrfs" do
      let(:scenario) { "btrfs2-devicegraph.xml" }

      let(:filesystem) { device("sdb1").filesystem }

      it "returns a name based on the filesystem sid" do
        expect(section.name_for_btrfs(filesystem)).to match(/#{filesystem.sid}/)
      end
    end
  end

  describe "#section_path" do
    let(:partitioning) do
      Y2Storage::AutoinstProfile::PartitioningSection.new_from_hashes(
        [{ "device" => "/dev/vda", "partitions" => [{ "mount" => "/" }] }]
      )
    end

    let(:drive) { partitioning.drives.first }

    subject(:section) { drive.partitions.first }

    it "returns the section path" do
      expect(section.section_path.to_s).to eq("partitioning,0,partitions,0")
    end
  end
end
