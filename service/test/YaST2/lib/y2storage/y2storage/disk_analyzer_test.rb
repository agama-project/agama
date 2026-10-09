#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016-2021] SUSE LLC
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

require "y2storage"

describe Y2Storage::DiskAnalyzer do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:analyzer) { described_class.new(fake_devicegraph) }
  let(:scenario) { "mixed_disks" }

  before do
    fake_scenario(scenario)
  end

  describe "#windows_system?" do
    let(:scenario) { "double-windows-pc" }

    context "when the architecture is not supported by Windows" do
      let(:architecture) { :ppc }

      it "returns false" do
        expect(analyzer.windows_system?).to eq(false)
      end

      it "does not inspect any filesystem" do
        expect_any_instance_of(Y2Storage::Filesystems::Base).to_not receive(:windows_system?)

        analyzer.windows_system?
      end
    end

    context "when the architecture is supported by Windows" do
      let(:architecture) { :x86_64 }

      context "and there is a partition with a Windows system" do
        before do
          allow(Y2Storage::FilesystemReader).to receive(:new).and_return(reader)

          allow(reader).to receive(:windows?).and_return(*windows)
        end

        let(:reader) { double("Y2Storage::FilesystemReader").as_null_object }

        let(:windows) { [true] }

        it "returns true" do
          expect(analyzer.windows_system?).to eq(true)
        end

        context "when a Windows is found for a filesystem" do
          before do
            allow_any_instance_of(Y2Storage::Filesystems::Base)
              .to receive(:windows_suitable?).and_return(true)
          end

          let(:windows) { [true, false, false, false] }

          it "does not check the next filesystem" do
            expect(Y2Storage::FilesystemReader).to receive(:new).once.and_return(reader)

            analyzer.windows_system?
          end
        end

        context "when a Windows is not found for a filesystem" do
          before do
            allow_any_instance_of(Y2Storage::Filesystems::Base)
              .to receive(:windows_suitable?).and_return(true)
          end

          let(:windows) { [false, false, true, true] }

          it "checks the next filesystem" do
            expect(Y2Storage::FilesystemReader).to receive(:new).exactly(3).times.and_return(reader)

            analyzer.windows_system?
          end
        end
      end
    end
  end

  describe "#windows_partitions" do
    context "in a PC" do
      context "for disks with no Windows" do
        it "returns an empty array" do
          expect(analyzer.windows_partitions("/dev/sdb").empty?).to eq(true)
        end
      end

      context "for disks with some Windows in a PC system" do
        let(:scenario) { "windows-pc-gpt" }
        let(:architecture) { :x86_64 }

        before do
          # A bit ugly mock, but what we want to achieve is to simulate that one of available
          # windows partitions cannot be properly detected due an Storage exception (bsc#1101979).
          allow_any_instance_of(::Storage::BlkFilesystem).to receive(:detect_content_info) do |fs|
            raise ::Storage::Exception if fs.label == "recovery"

            double("::Storage::ContentInfo", windows?: true)
          end
        end

        it "returns an array of detected Windows partitions" do
          expect(analyzer.windows_partitions("/dev/sda")).to match_array([Y2Storage::Partition])
        end

        it "does not include partitions with undetectable content info" do
          expect(analyzer.windows_partitions("/dev/sda").map(&:name)).to_not include("/dev/sda2")
        end
      end
    end

    context "in a non-PC system" do
      let(:architecture) { :s390 }

      it "returns an empty array" do
        expect(analyzer.windows_partitions.empty?).to eq(true)
      end
    end
  end

  describe "#linux_partitions" do
    context "for a disk with no linux partitions" do
      let(:scenario) { "windows-pc-gpt" }

      it "returns an empty array" do
        expect(analyzer.linux_partitions("/dev/sda").empty?).to eq(true)
      end
    end

    context "for a disk with linux partitions" do
      let(:scenario) { "mixed_disks" }

      it "returns a list of partitions" do
        expect(analyzer.linux_partitions("/dev/sda")).to be_a(Array)
        expect(analyzer.linux_partitions("/dev/sda")).to all(be_a(Y2Storage::Partition))
      end

      it "includes all linux partitions" do
        expect(analyzer.linux_partitions("/dev/sda").map(&:basename)).to contain_exactly("sda2")
      end
    end

    context "when no disk is indicated" do
      let(:scenario) { "mixed_disks" }

      it "includes all linux partitions from all disks" do
        expect(analyzer.linux_partitions.map(&:basename))
          .to contain_exactly("sda2", "sdb1", "sdb2", "sdb3", "sdb5", "sdb6", "sdb7")
      end
    end
  end

  describe "#installed_systems" do
    before do
      allow_any_instance_of(::Storage::BlkFilesystem).to receive(:detect_content_info)
        .and_return(content_info)
      allow_any_instance_of(Y2Storage::Filesystems::Base).to receive(:release_name)
        .and_return release_name
    end

    let(:architecture) { :x86_64 }
    let(:content_info) { double("::Storage::ContentInfo", windows?: true) }

    let(:release_name) { "openSUSE" }

    context "when there is a disk with a Windows" do
      it "returns 'Windows' as installed system for the corresponding disk" do
        expect(analyzer.installed_systems("/dev/sda")).to include("Windows")
      end

      it "does not return 'Windows' for other disks" do
        expect(analyzer.installed_systems("/dev/sdb")).not_to include("Windows")
        expect(analyzer.installed_systems("/dev/sdc")).not_to include("Windows")
      end
    end

    context "when there is a Linux" do
      it "returns release name for the corresponding disks" do
        expect(analyzer.installed_systems("/dev/sda")).to include(release_name)
        expect(analyzer.installed_systems("/dev/sdb")).to include(release_name)
      end

      it "does not return release name for other disks" do
        expect(analyzer.installed_systems("/dev/sdc")).not_to include(release_name)
      end
    end

    context "when there are several installed systems in a disk" do
      it "returns all installed systems for that disk" do
        expect(analyzer.installed_systems("/dev/sda"))
          .to contain_exactly("Windows", release_name)
      end
    end

    context "when there are not installed systems in a disk" do
      it "does not return installed systems for that disk" do
        expect(analyzer.installed_systems("/dev/sdc")).to be_empty
      end
    end
  end

  describe "#fstabs" do
    before do
      allow_any_instance_of(Y2Storage::Filesystems::Base)
        .to receive(:fstab).and_return(Y2Storage::Fstab.new)
    end

    it "returns a list of fstab files" do
      fstabs = analyzer.fstabs

      expect(fstabs).to be_a(Array)
      expect(fstabs).to all(be_a(Y2Storage::Fstab))
    end

    it "return fstab files from all root suitable filesystems" do
      expect(analyzer.fstabs.size).to eq(5)
    end

    it "does not try to read fstab files again in subsequent calls" do
      analyzer.fstabs

      expect(Y2Storage::Fstab).to_not receive(:new)

      analyzer.fstabs
    end
  end

  describe "#crypttabs" do
    before do
      allow_any_instance_of(Y2Storage::Filesystems::Base)
        .to receive(:crypttab).and_return(Y2Storage::Crypttab.new)
    end

    it "returns a list of crypttab files" do
      crypttabs = analyzer.crypttabs

      expect(crypttabs).to be_a(Array)
      expect(crypttabs).to all(be_a(Y2Storage::Crypttab))
    end

    it "return crypttab files from suitable root filesystems" do
      expect(analyzer.crypttabs.size).to eq(5)
    end

    it "does not try to read crypttab files again in subsequent calls" do
      analyzer.crypttabs

      expect(Y2Storage::Crypttab).to_not receive(:new)

      analyzer.crypttabs
    end
  end

  describe "#candidate_disks" do
    def find_device(device_name)
      devicegraph.find_by_name(device_name)
    end

    def format_device(device)
      device.remove_descendants
      device.create_filesystem(Y2Storage::Filesystems::Type::EXT4)
    end

    let(:scenario) { "empty_disks" }

    let(:devicegraph) { Y2Storage::StorageManager.instance.probed }
    let(:arch) { instance_double("Y2Storage::Arch", efiboot?: efi) }
    let(:efi) { true }

    let(:sda) { find_device("/dev/sda") }
    let(:sda1) { find_device("/dev/sda1") }
    let(:sdb) { find_device("/dev/sdb") }
    let(:sdc) { find_device("/dev/sdc") }

    let(:candidate_disks) { analyzer.candidate_disks.map(&:name) }

    before do
      allow(Y2Packager::Repository).to receive(:all).and_return(repositories)
      allow(Y2Storage::StorageManager.instance).to receive(:arch).and_return arch
    end

    let(:repositories) { [] }

    it "returns a list with all disk devices" do
      expect(candidate_disks).to contain_exactly("/dev/sda", "/dev/sdb", "/dev/sdc")
    end

    context "when there are some stray block devices (Xen virtual partitions)" do
      let(:scenario) { "xen-disks-and-partitions.xml" }

      it "includes the Xen devices representing disks" do
        expect(candidate_disks).to include("/dev/xvdc")
      end

      it "does not include the Xen devices representing partitions" do
        expect(candidate_disks).to_not include("/dev/xvda1")
        expect(candidate_disks).to_not include("/dev/xvda2")
      end
    end

    context "when a disk device is directly formatted" do
      before do
        format_device(sdb)

        sdb.filesystem.mount_path = "/foo"
        sdb.filesystem.mount_point.active = active_mount_point
      end

      context "and it is not mounted" do
        let(:active_mount_point) { false }

        it "includes the disk device" do
          expect(candidate_disks).to include("/dev/sdb")
        end
      end

      context "and it is mounted" do
        let(:active_mount_point) { true }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sdb")
        end
      end
    end

    context "when a disk device is used as LVM PV" do
      # Creates a LVM VG with two PVs and a LV
      before do
        sda.remove_descendants
        sdb.remove_descendants

        vg = Y2Storage::LvmVg.create(devicegraph, "vg0")
        vg.add_lvm_pv(sda)
        vg.add_lvm_pv(sdb)

        lv = vg.create_lvm_lv("lv1", Y2Storage::LvType::NORMAL, 2.GiB)
        format_device(lv)

        lv.filesystem.mount_path = "/foo"
        lv.filesystem.mount_point.active = active_mount_point
      end

      context "and the LVM VG has no mounted LV" do
        let(:active_mount_point) { false }

        it "includes the disk devices used by the LVM VG" do
          expect(candidate_disks).to include("/dev/sda", "/dev/sdb")
        end
      end

      context "and the LVM VG has a mounted LV" do
        let(:active_mount_point) { true }

        it "does not include the disk devices used by the LVM VG" do
          expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
        end
      end
    end

    context "when a disk device is used for a MD RAID" do
      let(:active_mount_point) { false }
      let(:md) do
        md0 = Y2Storage::Md.create(devicegraph, "/dev/md0")
        md0.md_level = Y2Storage::MdLevel::RAID0
        md0
      end

      # Creates a MD RAID
      before do
        sda1.remove_descendants
        sdb.remove_descendants

        md.add_device(sda1)
        md.add_device(sdb)
      end

      context "and the MD RAID is also a valid candidate" do
        context "because it does not have children" do
          it "includes the MD RAID" do
            expect(candidate_disks).to include("/dev/md0")
          end

          it "does not include the disk devices used by the MD RAID" do
            expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
          end

          context "but any of its ancestors is mounted" do
            before do
              format_device(sda1)
              sda1.filesystem.mount_path = "/foo"
              sda1.filesystem.mount_point.active = true
            end

            it "does not includes the MD RAID" do
              expect(candidate_disks).to_not include("/dev/md0")
            end
          end
        end

        context "because it has a partition table" do
          before do
            md.ensure_partition_table

            partition = create_next_partition(md)
            format_device(partition)

            partition.filesystem.mount_path = "/foo"
            partition.filesystem.mount_point.active = active_mount_point
          end

          it "includes the MD RAID" do
            expect(candidate_disks).to include("/dev/md0")
          end

          it "does not include the disk devices used by the MD RAID" do
            expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
          end

          context "but any of its descendants is mounted" do
            let(:active_mount_point) { true }

            it "does not include the MD RAID" do
              expect(candidate_disks).to_not include("/dev/md0")
            end
          end
        end
      end

      context "but the MD RAID is not a valid candidate because it is formatted" do
        before do
          format_device(md)

          md.filesystem.mount_path = "/foo"
          md.filesystem.mount_point.active = active_mount_point
        end

        context "and is mounted" do
          let(:active_mount_point) { true }

          it "does not include the disks devices used by the MD RAID" do
            expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
          end
        end

        context "and is not mounted" do
          let(:active_mount_point) { false }

          it "includes the disk devices used by the MD RAID" do
            expect(candidate_disks).to include("/dev/sda", "/dev/sdb")
          end
        end
      end

      context "but the MD RAID is not a valid candidate because EFI is not being used" do
        let(:efi) { false }

        it "includes the disk devices used by the MD RAID" do
          expect(candidate_disks).to include("/dev/sda", "/dev/sdb")
        end

        it "does not include the MD RAID" do
          expect(candidate_disks).to_not include("/dev/md0")
        end
      end
    end

    context "when a disk device contains a formatted partition" do
      before do
        format_device(sda1)

        sda1.filesystem.mount_path = "/foo"
        sda1.filesystem.mount_point.active = active_mount_point
      end

      context "and the partition is not mounted" do
        let(:active_mount_point) { false }

        it "includes the disk device" do
          expect(candidate_disks).to include("/dev/sda")
        end
      end

      context "and the partition is mounted" do
        let(:active_mount_point) { true }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sda")
        end
      end
    end

    context "when a disk device contains a partition used as LVM PV" do
      # Creates a LVM VG
      before do
        sda1.remove_descendants
        sdb.remove_descendants

        vg = Y2Storage::LvmVg.create(devicegraph, "vg0")
        vg.add_lvm_pv(sda1)
        vg.add_lvm_pv(sdb)

        lv = vg.create_lvm_lv("lv1", Y2Storage::LvType::NORMAL, 2.GiB)
        format_device(lv)

        lv.filesystem.mount_path = "/foo"
        lv.filesystem.mount_point.active = active_mount_point
      end

      context "and the LVM VG has no mounted LV" do
        let(:active_mount_point) { false }

        it "includes the disk devices used by the LVM VG" do
          expect(candidate_disks).to include("/dev/sda", "/dev/sdb")
        end
      end

      context "and the LVM VG has a mounted LV" do
        let(:active_mount_point) { true }

        it "does not include the disk devices used by the LVM VG" do
          expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
        end
      end
    end

    context "when a disk device contains a partition used for a MD RAID" do
      # Creates a MD RAID
      before do
        sda1.remove_descendants
        sdb.remove_descendants

        md = Y2Storage::Md.create(devicegraph, "/dev/md0")
        md.add_device(sda1)
        md.add_device(sdb)

        format_device(md)

        md.filesystem.mount_path = "/foo"
        md.filesystem.mount_point.active = active_mount_point
      end

      context "and the MD RAID is not mounted" do
        let(:active_mount_point) { false }

        it "includes the disk devices used by the MD RAID" do
          expect(candidate_disks).to include("/dev/sda", "/dev/sdb")
        end
      end

      context "and the MD RAID is mounted" do
        let(:active_mount_point) { true }

        it "does not include the disk devices used by the MD RAID" do
          expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
        end
      end
    end

    context "when there are installation repositories" do
      let(:repositories) { [repository] }

      let(:repository) { double(Y2Packager::Repository, local?: true, url: repository_url) }

      let(:repository_url) { "" }

      context "when a CD installation repository is placed in a device" do
        let(:repository_url) { "cd:/?devices=/dev/sda" }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sda")
        end
      end

      context "when a DVD installation repository is placed in a device" do
        let(:repository_url) { "dvd:/?devices=/dev/sda" }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sda")
        end
      end

      context "when a HD installation repository is placed in a device" do
        let(:repository_url) { "hd:/subdir?device=/dev/sda&filesystem=reiserfs" }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sda")
        end
      end

      context "when an ISO installation repository is placed in a device" do
        let(:repository_url) { "iso:/?iso=DVD1.iso&url=hd:/directory/?device=/dev/sdb" }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sdb")
        end
      end

      context "when an installation repository is placed in a partition" do
        let(:repository_url) { "dvd:/?devices=/dev/sda1" }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sda")
        end
      end

      context "when an installation repository is placed in several devices" do
        let(:repository_url) { "dvd:/?devices=/dev/sda1,/dev/sdb" }

        it "does not include any of that disk devices" do
          expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
        end
      end

      context "when there are several repositories" do
        let(:repositories) { [repository1, repository2] }

        let(:repository1) do
          double(Y2Packager::Repository, local?: true, url: "dvd:/?devices=/dev/sda1")
        end

        let(:repository2) do
          double(Y2Packager::Repository, local?: true, url: "hd:/?device=/dev/sdc")
        end

        it "does not include disk devices from all repositories" do
          expect(candidate_disks).to_not include("/dev/sda", "/dev/sdc")
          expect(candidate_disks).to include("/dev/sdb")
        end
      end

      context "when an installation repository is placed in an LVM LV" do
        # Creates a LVM VG
        before do
          sda1.remove_descendants
          sdb.remove_descendants

          vg = Y2Storage::LvmVg.create(devicegraph, "vg0")
          vg.add_lvm_pv(sda1)
          vg.add_lvm_pv(sdb)

          vg.create_lvm_lv("lv1", Y2Storage::LvType::NORMAL, 2.GiB)
        end

        let(:repository_url) { "dvd:/?devices=/dev/vg0/lv1" }

        it "does not include the disk devices used by the LVM VG" do
          expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
        end
      end

      context "when an installation repository is placed in a MD RAID" do
        # Creates a MD RAID
        before do
          sda1.remove_descendants
          sdb.remove_descendants

          md = Y2Storage::Md.create(devicegraph, "/dev/md0")
          md.add_device(sda1)
          md.add_device(sdb)
        end

        let(:repository_url) { "dvd:/?devices=/dev/md0" }

        it "does not include the disk devices used by the MD RAID" do
          expect(candidate_disks).to_not include("/dev/sda", "/dev/sdb")
        end
      end

      context "when the url of an installation repository points to an udev symlink" do
        before do
          allow(Y2Storage::BlkDevice).to receive(:find_by_any_name)
            .with(fake_devicegraph, udev_name).and_return(sda1)
        end

        let(:udev_name) { "/dev/disk/by-id/111-222-3333" }

        let(:repository_url) { "dvd:/?devices=#{udev_name}" }

        it "does not include the disk device" do
          expect(candidate_disks).to_not include("/dev/sda1")
        end
      end
    end

    context "when there are some RAM disks (PXE scenario with Agama)" do
      let(:scenario) { "agama_pxe" }

      it "includes only the real physical disks" do
        expect(candidate_disks).to eq ["/dev/sda"]
      end
    end
  end
end
