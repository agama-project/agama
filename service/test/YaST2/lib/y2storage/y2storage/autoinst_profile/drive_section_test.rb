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

describe Y2Storage::AutoinstProfile::DriveSection do
  include_context "yast2-storage-ng test setup"

  def device(name)
    Y2Storage::BlkDevice.find_by_name(fake_devicegraph, "/dev/#{name}")
  end

  def lvm_vg(name)
    fake_devicegraph.lvm_vgs.find { |v| v.vg_name == name }
  end

  def nfs(server, path)
    Y2Storage::Filesystems::Nfs.find_by_server_and_path(fake_devicegraph, server, path)
  end

  include_examples "autoinst section"

  before do
    fake_scenario(scenario)
  end

  subject(:section) { described_class.new }

  let(:scenario) { "autoyast_drive_examples" }

  describe ".new_from_hashes" do
    let(:hash) { { "partitions" => [root] } }

    let(:root) { { "mount" => "/" } }

    it "initializes partitions" do
      expect(Y2Storage::AutoinstProfile::PartitionSection).to receive(:new_from_hashes)
        .with(root, Y2Storage::AutoinstProfile::DriveSection)
      described_class.new_from_hashes(hash)
    end

    context "when type is not specified" do
      it "initializes it to :CT_DISK" do
        expect(described_class.new_from_hashes(hash).type).to eq(:CT_DISK)
      end

      context "and device name starts by /dev/md" do
        let(:hash) { { "device" => "/dev/md0" } }

        it "initializes it to :CT_MD" do
          expect(described_class.new_from_hashes(hash).type).to eq(:CT_MD)
        end
      end

      context "and device name starts by /dev/bcache" do
        let(:hash) { { "device" => "/dev/bcache0" } }

        it "initializes it to :CT_BCACHE" do
          expect(described_class.new_from_hashes(hash).type).to eq(:CT_BCACHE)
        end
      end

      # Old format for NFS shares
      context "and device name is /dev/nfs" do
        let(:hash) { { "device" => "/dev/nfs" } }

        it "initializes it to :CT_NFS" do
          expect(described_class.new_from_hashes(hash).type).to eq(:CT_NFS)
        end
      end
    end

    # New format for NFS shares
    context "and the device is a NFS share (server:path)" do
      let(:nfs_hash) { { "device" => "192.168.56.1:/root_fs" } }

      context "and the type is specified (it must be CT_NFS)" do
        let(:hash) { nfs_hash.merge("type" => :CT_NFS) }

        it "sets the given type" do
          expect(described_class.new_from_hashes(hash).type).to eq(:CT_NFS)
        end
      end

      context "and the type is not specified" do
        let(:hash) { nfs_hash }

        # Type attribute is mandatory for NFS drives with the new format. Otherwise,
        # the type would be wrongly initialized.
        it "initializes it to :CT_DISK" do
          expect(described_class.new_from_hashes(hash).type).to eq(:CT_DISK)
        end
      end
    end

    context "when bcache options are given" do
      let(:hash) { { "partitions" => [root], "bcache_options" => bcache_options } }
      let(:bcache_options) { { "cache_mode" => "writethrough" } }

      it "initializes bcache options" do
        section = described_class.new_from_hashes(hash)
        expect(section.bcache_options.cache_mode).to eq("writethrough")
      end
    end

    context "when the raid options are given" do
      let(:hash) { { "partitions" => [root], "raid_options" => raid_options } }
      let(:raid_options) { { "raid_type" => "raid0" } }

      it "initializes raid options" do
        expect(Y2Storage::AutoinstProfile::RaidOptionsSection).to receive(:new_from_hashes)
          .with(raid_options, Y2Storage::AutoinstProfile::DriveSection)
          .and_call_original
        section = described_class.new_from_hashes(hash)
        expect(section.raid_options.raid_type).to eq("raid0")
      end

      context "and the raid_type is specified" do
        let(:raid_options) { { "raid_type" => "raid0" } }

        it "ignores the raid_name element" do
          section = described_class.new_from_hashes(hash)
          expect(section.raid_options.raid_name).to be_nil
        end
      end
    end

    context "when btrfs options are given" do
      let(:hash) { { "partitions" => [root], "btrfs_options" => btrfs_options } }
      let(:btrfs_options) { { "data_raid_level" => "single" } }

      it "initializes btrfs options" do
        section = described_class.new_from_hashes(hash)
        expect(section.btrfs_options.data_raid_level).to eq("single")
      end
    end

    context "when 'use' element is not specified" do
      let(:hash) { {} }

      it "uses nil" do
        expect(described_class.new_from_hashes(hash).use).to be_nil
      end
    end

    context "when 'use' element is specified as a list of numbers" do
      let(:hash) { { "use" => " 1,3, 5 " } }

      it "sets 'use' as an array of numbers" do
        expect(described_class.new_from_hashes(hash).use).to eq([1, 3, 5])
      end

      context "when a parent is given" do
        let(:parent) { double("parent") }
        let(:section) { described_class.new_from_hashes(hash, parent) }

        it "sets the index" do
          expect(section.parent).to eq(parent)
        end
      end
    end
  end

  describe ".new_from_storage" do
    let(:parent) { double("Installation::AutoinstProfile::SectionWithAttributes") }

    it "returns nil for a disk or DASD with no partitions" do
      expect(described_class.new_from_storage(device("dasda"))).to eq nil
      expect(described_class.new_from_storage(device("sda"))).to eq nil
    end

    it "returns nil for a volume group with no logical volumes" do
      expect(described_class.new_from_storage(lvm_vg("empty_vg"))).to eq nil
    end

    it "returns nil for a disk or DASD with no exportable partitions" do
      expect(described_class.new_from_storage(device("sdb"))).to eq nil
    end

    it "returns a DriveSection object for a disk or DASD with exportable partitions" do
      expect(described_class.new_from_storage(device("dasdb"))).to be_a described_class
      expect(described_class.new_from_storage(device("sdc"))).to be_a described_class
    end

    it "returns a DriveSection object for a volume group with logical volumes" do
      expect(described_class.new_from_storage(lvm_vg("vg0"))).to be_a described_class
    end

    it "returns a DriveSection object for a disk or DASD with exportable partitions" do
      expect(described_class.new_from_storage(device("dasdb"))).to be_a described_class
      expect(described_class.new_from_storage(device("sdc"))).to be_a described_class
    end

    it "returns a DriveSection object for a NFS filesystem" do
      nfs = Y2Storage::Filesystems::Nfs.create(fake_devicegraph, "srv", "/foo")
      expect(described_class.new_from_storage(nfs)).to be_a described_class
    end

    it "returns a DriveSection object for a tmpfs filesystem" do
      tmpfs = Y2Storage::Filesystems::Tmpfs.create(fake_devicegraph)
      expect(described_class.new_from_storage(tmpfs)).to be_a described_class
    end

    it "returns a DriveSection object for a multi-device Btrfs filesystem" do
      sdd1 = device("sdd1")
      sdd3 = device("sdd3")

      sdd1.remove_descendants

      btrfs = sdd3.filesystem
      btrfs.add_device(sdd1)

      expect(described_class.new_from_storage(btrfs)).to be_a described_class
    end

    it "sets the parent section" do
      section = described_class.new_from_storage(device("sdc"), parent)
      expect(section.parent).to eq(parent)
    end

    it "stores the exportable partitions as PartitionSection objects" do
      section = described_class.new_from_storage(device("dasdb"))
      expect(section.partitions).to all(be_a(Y2Storage::AutoinstProfile::PartitionSection))
      expect(section.partitions.size).to eq 3

      section = described_class.new_from_storage(device("sdc"))
      expect(section.partitions).to all(be_a(Y2Storage::AutoinstProfile::PartitionSection))
      expect(section.partitions.size).to eq 2
    end

    context "when the disk is not used" do
      it "returns nil" do
        section = described_class.new_from_storage(device("sda"))
        expect(section).to be_nil
      end
    end

    context "when the disk has no partitions but is used as a filesystem" do
      before { fake_scenario("unpartitioned-disk") }
      let(:dev) { device("sda") }

      it "includes a partition holding filesystem specification for the disk" do
        section = described_class.new_from_storage(dev)
        expect(section.partitions).to contain_exactly(
          an_object_having_attributes("create" => false, "filesystem" => :btrfs)
        )
      end

      context "when snapshots are enabled" do
        it "initializes enable_snapshots as 'true'" do
          section = described_class.new_from_storage(dev)
          expect(section.enable_snapshots).to eq(true)
        end
      end

      context "when snapshots are not enabled" do
        before do
          dev.filesystem.btrfs_subvolumes.first.remove_descendants
        end

        it "initializes enable_snapshots as 'false'" do
          section = described_class.new_from_storage(dev)
          expect(section.enable_snapshots).to eq(false)
        end
      end
    end

    context "when the disk has no partitions but it is used as LVM PV or RAID member" do
      let(:sda) { device("sda") }
      let(:pv) { double("pv") }

      before do
        allow(sda).to receive(:component_of).and_return([pv])
      end

      it "returns a section with disklabel set to 'none'" do
        section = described_class.new_from_storage(sda)
        expect(section.disklabel).to_not be_nil
      end
    end

    context "for the extended partition" do
      it "considers the partition to not be exportable" do
        section = described_class.new_from_storage(device("sdd"))
        expect(section.partitions.map(&:partition_nr)).to_not include(4)
      end
    end

    context "for primary and logical partitions" do
      context "with a typical Windows partition id" do
        before do
          # SWIG makes very hard to use proper mocking here with
          # allow(a_partition).to(receive(:y)) because you can get different
          # Ruby wrapper objects for the same C++ partition. So let's simply
          # assign the values instead of intercepting the query calls.
          sdd1 = dev.partitions.find { |i| i.name == "/dev/sdd1" }
          sdd1.boot = true if bootable
          sdd1.filesystem.mount_path = mountpoint if mountpoint
        end

        let(:dev) { device("sdd") }
        let(:mountpoint) { nil }

        context "and the boot flag enabled" do
          let(:bootable) { true }

          it "considers the partition to be exportable" do
            section = described_class.new_from_storage(dev)
            expect(section.partitions.map(&:partition_nr)).to include(1)
          end
        end

        context "that are mounted at /boot or some point below" do
          let(:bootable) { false }
          let(:mountpoint) { "/boot/something" }

          it "considers the partition to be exportable" do
            section = described_class.new_from_storage(dev)
            expect(section.partitions.map(&:partition_nr)).to include(1)
          end
        end

        context "that are not bootable or mounted under /boot" do
          let(:bootable) { false }

          it "considers the partition to not be exportable" do
            section = described_class.new_from_storage(dev)
            expect(section.partitions.map(&:partition_nr)).to_not include(1)
          end
        end
      end

      context "with a non-Windows partition id" do
        context "that can't be converted to PartitionSection object" do
          before do
            part_section_class = Y2Storage::AutoinstProfile::PartitionSection
            orig = part_section_class.method(:new_from_storage)

            allow(part_section_class).to receive(:new_from_storage) do |part|
              (part.name == "/dev/sdd3") ? nil : orig.call(part)
            end
          end

          it "considers the partition to not be exportable" do
            section = described_class.new_from_storage(device("sdd"))
            expect(section.partitions.map(&:partition_nr)).to_not include(3)
          end
        end

        context "that can be converted to a PartitionSection object" do
          it "considers the partition to be exportable" do
            section = described_class.new_from_storage(device("sdd"))
            expect(section.partitions.map(&:partition_nr)).to include(3)
          end
        end
      end

      it "initializes #type to :CT_DISK for both disks and DASDs" do
        expect(described_class.new_from_storage(device("dasdb")).type).to eq :CT_DISK
        expect(described_class.new_from_storage(device("sdc")).type).to eq :CT_DISK
      end

      context "when snapshots are enabled for some filesystem" do
        it "initializes 'enable_snapshots' to true" do
          section = described_class.new_from_storage(device("sdd"))
          expect(section.enable_snapshots).to eq(true)
        end
      end

      context "when snapshots are not enabled for any filesystem" do
        it "initializes 'enable_snapshots' to false" do
          section = described_class.new_from_storage(device("sdh"))
          expect(section.enable_snapshots).to eq(false)
        end
      end
    end

    context "given a MD RAID" do
      before { fake_scenario("nested_md_raids") }

      it "initializes #type to :CT_MD" do
        expect(described_class.new_from_storage(device("md0")).type).to eq :CT_MD
      end

      it "initializes device name" do
        expect(described_class.new_from_storage(device("md0")).device).to eq("/dev/md0")
      end

      it "initializes raid options" do
        expect(described_class.new_from_storage(device("md0")).raid_options)
          .to be_a(Y2Storage::AutoinstProfile::RaidOptionsSection)
      end

      context "when the RAID is partitioned" do
        before { fake_scenario("root_partitioned_md_raid") }

        it "initializes #disklabel to 'none'" do
          expect(described_class.new_from_storage(device("md0")).disklabel).to eq("gpt")
        end

        context "and snapshots are enabled for the root (/) partition" do
          it "initializes enable_snapshots setting to true" do
            expect(described_class.new_from_storage(device("md0")).enable_snapshots).to eq(true)
          end
        end

        context "and snapshots are not enabled for the root (/) partition" do
          before do
            md = device("md0")
            btrfs = md.partitions.map(&:filesystem).find { |f| f.mount_point.path == "/" }
            btrfs.btrfs_subvolumes.first.remove_descendants
          end

          it "initializes enable_snapshots setting to false" do
            expect(described_class.new_from_storage(device("md0")).enable_snapshots).to eq(false)
          end
        end

        context "and the RAID does not contain the root partition" do
          before { fake_scenario("partitioned_md_raid.xml") }

          it "does not initialize enable_snapshots setting" do
            expect(described_class.new_from_storage(device("md/md0")).enable_snapshots).to be_nil
          end
        end
      end

      context "when the RAID is not partitioned" do
        before { fake_scenario("md_raid") }

        it "initializes #disklabel to 'none'" do
          expect(described_class.new_from_storage(device("md/md0")).disklabel).to eq("none")
        end

        it "includes a #partitions section containing the filesystem information" do
          partitions = described_class.new_from_storage(device("md/md0")).partitions
          expect(partitions).to contain_exactly(
            an_object_having_attributes(filesystem: :xfs)
          )
        end

        context "and it is not used" do
          before do
            device("md/md0").remove_descendants
          end

          it "does not include a #partitions section" do
            partitions = described_class.new_from_storage(device("md/md0")).partitions
            expect(partitions).to be_empty
          end
        end

        context "and it is used as a component of an LVM" do
          before { fake_scenario("md_raid_lvm") }

          it "includes a #partition section with LVM and encryption information" do
            partitions = described_class.new_from_storage(device("md0")).partitions
            expect(partitions).to contain_exactly(
              an_object_having_attributes(lvm_group: "vg0", crypt_method: :luks1)
            )
          end
        end

        context "and it is mounted at /" do
          before { fake_scenario("root_md_raid") }

          context "and snapshots are enabled" do
            it "initializes enable_snapshots setting to true" do
              expect(
                described_class.new_from_storage(device("md/md0")).enable_snapshots
              ).to eq(true)
            end
          end

          context "and snapshots are not enabled" do
            before do
              md = device("md/md0")
              btrfs = md.filesystem
              btrfs.btrfs_subvolumes.first.remove_descendants
            end

            it "initializes enable_snapshots setting to false" do
              expect(
                described_class.new_from_storage(device("md/md0")).enable_snapshots
              ).to eq(false)
            end
          end
        end

        context "and it is not mounted at /" do
          before { fake_scenario("btrfs_md_raid.xml") }

          it "does not initialize enable_snapshots" do
            expect(described_class.new_from_storage(device("md/md0")).enable_snapshots).to be_nil
          end
        end
      end
    end

    context "given a volume group" do
      it "initializes #type to :CT_LVM" do
        expect(described_class.new_from_storage(lvm_vg("vg0")).type).to eq :CT_LVM
      end

      it "initializes the list of logical volumes" do
        vg = described_class.new_from_storage(lvm_vg("vg0"))
        expect(vg.partitions).to contain_exactly(
          an_object_having_attributes(lv_name: "lv1")
        )
      end

      it "initializes #pesize to the VG extent size" do
        expect(described_class.new_from_storage(lvm_vg("vg0")).pesize).to eq "4194304"
      end

      it "does not initializes 'use'" do
        expect(described_class.new_from_storage(lvm_vg("vg0")).use).to be_nil
      end

      context "when snapshots are enabled for some filesystem" do
        it "initializes 'enable_snapshots' to true" do
          section = described_class.new_from_storage(lvm_vg("vg0"))
          expect(section.enable_snapshots).to eq(true)
        end
      end

      context "when snapshots are not enabled for any filesystem" do
        it "initializes 'enable_snapshots' to false" do
          section = described_class.new_from_storage(lvm_vg("vg1"))
          expect(section.enable_snapshots).to eq(false)
        end
      end
    end

    context "given a bcache" do
      before { fake_scenario("btrfs_bcache.xml") }

      it "initializes #type to :CT_BCACHE" do
        expect(described_class.new_from_storage(device("bcache0")).type).to eq :CT_BCACHE
      end

      it "initializes device name" do
        expect(described_class.new_from_storage(device("bcache0")).device).to eq("/dev/bcache0")
      end

      it "initializes bcache options" do
        expect(described_class.new_from_storage(device("bcache0")).bcache_options)
          .to be_a(Y2Storage::AutoinstProfile::BcacheOptionsSection)
      end

      context "when the bcache is partitioned" do
        before { fake_scenario("partitioned_btrfs_bcache.xml") }

        context "and snapshots are enabled for some partition" do
          it "initializes enable_snapshots setting to true" do
            expect(described_class.new_from_storage(device("bcache0")).enable_snapshots).to eq(true)
          end
        end

        context "and snapshots are not enabled for any partition" do
          before do
            bcache = device("bcache0")
            btrfs = bcache.partitions.first.filesystem
            btrfs.btrfs_subvolumes.first.remove_descendants
          end

          it "initializes enable_snapshots setting to false" do
            expect(
              described_class.new_from_storage(device("bcache0")).enable_snapshots
            ).to eq(false)
          end
        end
      end

      context "when the bcache is not partitioned" do
        context "when snapshots are enabled" do
          before { fake_scenario("btrfs_bcache.xml") }

          it "initializes enable_snapshots setting" do
            expect(described_class.new_from_storage(device("bcache0")).enable_snapshots).to eq(true)
          end
        end

        context "when snapshots are not enabled" do
          before do
            bcache = device("bcache0")
            btrfs = bcache.filesystem
            btrfs.btrfs_subvolumes.first.remove_descendants
          end

          it "initializes enable_snapshots setting" do
            expect(
              described_class.new_from_storage(device("bcache0")).enable_snapshots
            ).to eq(false)
          end
        end
      end
    end

    context "given a stray block device" do
      before { fake_scenario("xen-partitions.xml") }

      it "initializes #type to :CT_LVM" do
        expect(described_class.new_from_storage(device("xvda2")).type).to eq :CT_DISK
      end

      it "initializes #disklabel to 'none'" do
        expect(described_class.new_from_storage(device("xvda2")).disklabel).to eq("none")
      end

      it "initializes #partitions to a partition describing the device options" do
        section = described_class.new_from_storage(device("xvda2"))
        expect(section.partitions).to contain_exactly(
          an_object_having_attributes(filesystem: :xfs)
        )
      end

      context "when the device is not used" do
        it "returns nil" do
          expect(described_class.new_from_storage(device("xvda1"))).to be_nil
        end
      end
    end

    context "given a NFS filesystems" do
      before do
        fake_scenario("nfs1.xml")
      end

      let(:section) { described_class.new_from_storage(nfs("srv", "/home/a")) }

      it "initializes device name" do
        expect(section.device).to eq("srv:/home/a")
      end

      it "initializes #type to :CT_NFS" do
        expect(section.type).to eq(:CT_NFS)
      end

      it "initializes #disklabel to 'none'" do
        expect(section.disklabel).to eq("none")
      end

      it "initializes #use to 'all'" do
        expect(section.use).to eq("all")
      end

      it "initializes #partitions to a partition describing the NFS options" do
        expect(section.partitions).to contain_exactly(
          an_object_having_attributes(mount: "/test1")
        )
      end
    end

    context "given a multi-device Btrfs filesystems" do
      let(:scenario) { "btrfs2-devicegraph.xml" }

      let(:section) { described_class.new_from_storage(filesystem) }

      let(:filesystem) { device("sdb1").filesystem }

      it "initializes device name" do
        expect(section.device).to match(/btrfs_\d+/)
      end

      it "initializes #type to :CT_BTRFS" do
        expect(section.type).to eq(:CT_BTRFS)
      end

      it "initializes #disklabel to 'none'" do
        expect(section.disklabel).to eq("none")
      end

      it "initializes #use to 'all'" do
        expect(section.use).to eq("all")
      end

      it "initializes #partitions to a partition describing the filesystem options" do
        expect(section.partitions).to contain_exactly(
          an_object_having_attributes(
            filesystem: :btrfs,
            mount:      "/test",
            mountby:    :device
          )
        )
      end

      it "initializes btrfs options" do
        expect(section.btrfs_options).to be_a(Y2Storage::AutoinstProfile::BtrfsOptionsSection)
      end

      context "when the filesystem is mounted at /" do
        before do
          allow(filesystem).to receive(:root?).and_return(true)
          filesystem.configure_snapper = snapshots?
        end

        context "and snapshots are enabled" do
          let(:snapshots?) { true }

          it "initializes enable_snapshots setting to true" do
            expect(section.enable_snapshots).to eq(true)
          end
        end

        context "and snapshots are disabled" do
          let(:snapshots?) { false }

          it "initializes enable_snapshots setting to false" do
            expect(section.enable_snapshots).to eq(false)
          end
        end
      end

      context "when the filesystem is not mounted at /" do
        before do
          allow(filesystem).to receive(:root?).and_return(false)
          filesystem.configure_snapper = true
        end

        it "does not initialize the enable_snapshots setting" do
          expect(section.enable_snapshots).to be_nil
        end
      end
    end

    describe "initializing DriveSection#device" do
      let(:dev) { device("sdd") }

      before do
        allow(dev).to receive(:udev_full_paths)
          .and_return ["/dev/disk/by-path/1", "/dev/disk/by-path/2"]
      end

      context "in s390" do
        let(:architecture) { :s390 }

        it "initializes #device to the udev path of the device" do
          section = described_class.new_from_storage(dev)
          expect(section.device).to eq "/dev/disk/by-path/1"
        end
      end

      context "in a non-s390 architecture" do
        let(:architecture) { :x86_64 }

        it "initializes #device to the kernel name of the device" do
          section = described_class.new_from_storage(dev)
          expect(section.device).to eq "/dev/sdd"
        end
      end
    end

    context "if there are no partitions with a typical Windows id in the disk" do
      let(:dev) { device("dasdb") }

      it "does not alter the initial value of #create for the partitions" do
        section = described_class.new_from_storage(dev)
        expect(section.partitions.map(&:create)).to all(eq(true))
      end

      it "initializes #use to 'all'" do
        section = described_class.new_from_storage(dev)
        expect(section.use).to eq "all"
      end
    end

    context "if there is some partition with a typical Windows id" do
      let(:dev) { device("sdaa") }

      before do
        # SWIG makes very hard to use proper mocking. See comment above.
        win = dev.partitions.min_by(&:number)
        win.boot = true if bootable
        win.filesystem.mount_path = mountpoint if mountpoint
      end

      let(:mountpoint) { nil }
      let(:bootable) { false }

      context "and the Windows-alike partition is marked with the boot flag" do
        let(:bootable) { true }

        it "initializes #use to 'all'" do
          section = described_class.new_from_storage(dev)
          expect(section.use).to eq "all"
        end

        it "does not alter the initial value of #create for the partitions" do
          section = described_class.new_from_storage(dev)
          expect(section.partitions.map(&:create)).to all(eq(true))
        end
      end

      context "and the Windows-alike partitions is mounted at /boot or below" do
        let(:mountpoint) { "/boot" }

        it "initializes #use to 'all'" do
          section = described_class.new_from_storage(dev)
          expect(section.use).to eq "all"
        end

        it "does not alter the initial value of #create for the partitions" do
          section = described_class.new_from_storage(dev)
          expect(section.partitions.map(&:create)).to all(eq(true))
        end
      end

      context "and the Windows partition is not marked as bootable nor mounted at /boot" do
        it "initializes #use to the list of exported partition numbers" do
          section = described_class.new_from_storage(dev)
          expect(section.use).to eq [2, 3]
        end

        context "and the Windows partition(s) are the first partitions in the disk" do
          it "does not alter the initial value of #create for the partitions" do
            section = described_class.new_from_storage(dev)
            expect(section.partitions.map(&:create)).to all(eq(true))
          end
        end

        context "and there is any non-Windows partition before it in the disk" do
          context "if the non-Windows partition is an extended one" do
            let(:dev) { device("sdf") }

            it "does not alter the initial value of #create for the partitions" do
              section = described_class.new_from_storage(dev)
              expect(section.partitions.map(&:create)).to all(eq(true))
            end
          end

          context "if the non-Windows partition is not extended" do
            let(:dev) { device("sdd") }

            it "sets #create to false for all the partitions" do
              section = described_class.new_from_storage(dev)
              expect(section.partitions.map(&:create)).to all(eq(false))
            end
          end
        end
      end
    end
  end

  describe "#to_hashes" do
    subject(:section) { described_class.new }

    it "returns a hash with all the non-blank values using strings as keys" do
      section.type = :CT_DISK
      section.use = "all"
      expect(section.to_hashes).to eq("type" => :CT_DISK, "use" => "all")
    end

    it "returns an empty hash if all the values are blank" do
      expect(section.to_hashes).to eq({})
    end

    it "exports #initialize_attr as 'initialize'" do
      section.initialize_attr = true
      hash = section.to_hashes
      expect(hash.keys).to include "initialize"
      expect(hash.keys).to_not include "initialize_attr"
      expect(hash["initialize"]).to eq true
    end

    it "does not export nil values" do
      section.disklabel = nil
      section.is_lvm_vg = nil
      section.partitions = nil
      hash = section.to_hashes
      expect(hash.keys).to_not include "disklabel"
      expect(hash.keys).to_not include "is_lvm_vg"
      expect(hash.keys).to_not include "partitions"
    end

    it "does not export empty collections (#partitions, #skip_list)" do
      section.partitions = []
      section.skip_list = []
      hash = section.to_hashes
      expect(hash.keys).to_not include "partitions"
      expect(hash.keys).to_not include "skip_list"
    end

    it "exports #partitions and #skip_list as arrays of hashes" do
      part1 = Y2Storage::AutoinstProfile::PartitionSection.new
      part1.create = true
      section.partitions << part1
      part2 = Y2Storage::AutoinstProfile::PartitionSection.new
      part2.create = false
      section.partitions << part2
      rule = instance_double(Y2Storage::AutoinstProfile::SkipRule, to_profile_rule: {})
      section.skip_list = Y2Storage::AutoinstProfile::SkipListSection.new([rule])

      hash = section.to_hashes

      expect(hash["partitions"]).to be_a(Array)
      expect(hash["partitions"].size).to eq 2
      expect(hash["partitions"]).to all(be_a(Hash))

      expect(hash["skip_list"]).to be_a(Array)
      expect(hash["skip_list"].size).to eq 1
      expect(hash["skip_list"].first).to be_a Hash
    end

    it "exports false values" do
      section.is_lvm_vg = false
      hash = section.to_hashes
      expect(hash.keys).to include "is_lvm_vg"
      expect(hash["is_lvm_vg"]).to eq false
    end

    it "does not export empty strings" do
      section.device = ""
      expect(section.to_hashes.keys).to_not include "device"
    end

    context "when use is a list of partition numbers" do
      before do
        section.use = [1, 2, 3]
      end

      it "exports 'use' as a string" do
        expect(section.to_hashes).to include("use" => "1,2,3")
      end
    end
  end

  describe "#name_for_md" do
    let(:part1) do
      instance_double(
        Y2Storage::AutoinstProfile::PartitionSection, name_for_md: "/dev/md/named", partition_nr: 1
      )
    end
    let(:part2) { instance_double(Y2Storage::AutoinstProfile::PartitionSection) }

    before do
      section.device = "/dev/md/data"
    end

    it "returns the device name" do
      expect(section.name_for_md).to eq("/dev/md/data")
    end

    context "when using the old format" do
      before do
        section.device = "/dev/md"
        section.partitions = [part1, part2]
      end

      it "returns the name for md from the same partition" do
        expect(section.name_for_md).to eq(part1.name_for_md)
      end
    end
  end

  describe "#wanted_partitions?" do
    context "when diskabel is missing" do
      it "returns false" do
        expect(section.wanted_partitions?).to eq(false)
      end
    end

    context "when disklabel is not set to 'none'" do
      before do
        section.disklabel = "gpt"
      end

      it "returns true" do
        expect(section.wanted_partitions?).to eq(true)
      end
    end

    context "when disklabel is set to 'none'" do
      before do
        section.disklabel = "none"
      end

      it "returns false" do
        expect(section.wanted_partitions?).to eq(false)
      end
    end

    context "when any partition section has the partition_nr set to '0'" do
      before do
        section.disklabel = "gpt"
        section.partitions = [
          Y2Storage::AutoinstProfile::PartitionSection.new_from_hashes("partition_nr" => 0)
        ]
      end

      it "returns false" do
        expect(section.wanted_partitions?).to eq(false)
      end
    end
  end

  describe "#unwanted_partitions?" do
    context "when diskabel is missing" do
      it "returns false" do
        expect(section.unwanted_partitions?).to eq(false)
      end
    end

    context "when disklabel is not set to 'none'" do
      before do
        section.disklabel = "gpt"
      end

      it "returns false" do
        expect(section.unwanted_partitions?).to eq(false)
      end
    end

    context "when disklabel is set to 'none'" do
      before do
        section.disklabel = "none"
      end

      it "returns true" do
        expect(section.unwanted_partitions?).to eq(true)
      end
    end

    context "when any partition section has the partition_nr set to '0'" do
      before do
        section.disklabel = "gpt"
        section.partitions = [
          Y2Storage::AutoinstProfile::PartitionSection.new_from_hashes("partition_nr" => 0)
        ]
      end

      it "returns true" do
        expect(section.unwanted_partitions?).to eq(true)
      end
    end
  end

  describe "#master_partition" do
    let(:part0_spec) do
      Y2Storage::AutoinstProfile::PartitionSection.new_from_hashes(
        "mount" => "/", "partition_nr" => 0
      )
    end

    let(:home_spec) { Y2Storage::AutoinstProfile::PartitionSection.new }

    context "when diskabel is set to 'none'" do
      before do
        section.disklabel = "none"
        section.partitions = [home_spec, part0_spec]
      end

      it "returns the partition which partition_nr is set to '0'" do
        expect(section.master_partition).to eq(part0_spec)
      end

      context "but no partition section has the partition_nr set to '0'" do
        before do
          section.partitions = [home_spec]
        end

        it "returns the first one" do
          expect(section.master_partition).to eq(home_spec)
        end
      end

      context "but no partition section is defined" do
        before do
          section.partitions = []
        end

        it "returns nil" do
          expect(section.master_partition).to be_nil
        end
      end
    end

    context "when a partition section has the partition_nr set to '0'" do
      before do
        section.partitions = [home_spec, part0_spec]
      end

      it "returns that partition section" do
        expect(section.master_partition).to eq(part0_spec)
      end

      context "and disklabel is set to a value different than '0'" do
        before do
          section.disklabel = "gpt"
        end

        it "still returns the partition section which has the partition_nr set to '0'" do
          expect(section.master_partition).to eq(part0_spec)
        end
      end
    end

    context "for a drive describing a multi-device btrfs" do
      let(:scenario) { "btrfs2-devicegraph.xml" }
      let(:section) { described_class.new_from_storage(filesystem) }
      let(:filesystem) { device("sdb1").filesystem }

      before do
        # The disklabel attribute is irrelevant here. Even if it's omitted, everything should work
        section.disklabel = nil
      end

      it "returns the first partition section" do
        expect(section.master_partition.mount).to eq "/test"
      end

      it "returns nil if there are no partitions" do
        section.partitions = []
        expect(section.master_partition).to be_nil
      end
    end
  end

  describe "#section_path" do
    let(:partitioning) do
      Y2Storage::AutoinstProfile::PartitioningSection.new_from_hashes(
        [{ "device" => "/dev/vda", "partitions" => [{ "mount" => "/" }] }]
      )
    end

    subject(:section) { partitioning.drives.first }

    it "returns 'partitioning,index'" do
      expect(section.section_path.to_s).to eq("partitioning,0")
    end
  end
end
