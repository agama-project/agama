#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2023] SUSE LLC
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

describe Y2Storage::Devicegraph do
  include_context "yast2-storage-ng test setup"

  # Used to check sorting by name
  def less_than_next?(device, collection)
    next_dev = collection[collection.index(device) + 1]
    next_dev.nil? || device.compare_by_name(next_dev) < 0
  end

  describe "#copy" do
    subject { fake_devicegraph }

    before do
      fake_scenario("mixed_disks")

      subject.probing_issues = Y2Issues::List.new([Y2Storage::Issue.new("Issue 1")])
    end

    let(:other_devicegraph) do
      devicegraph = subject.dup
      devicegraph.probing_issues = Y2Issues::List.new
      disk = devicegraph.find_by_name("/dev/sda")
      disk.delete_partition_table
      devicegraph
    end

    it "copies the content into the given devicegraph" do
      subject.copy(other_devicegraph)
      expect(subject).to eq(other_devicegraph)
    end

    it "copies the issues into the given devicegraph" do
      expect(subject.probing_issues)
        .to_not eq(other_devicegraph.probing_issues)

      subject.copy(other_devicegraph)

      issues = other_devicegraph.probing_issues

      expect(issues).to eq(subject.probing_issues)
      expect(issues.to_a.size).to eq(1)
      expect(issues.to_a.first.message).to eq("Issue 1")
    end
  end

  describe "#safe_copy" do
    before do
      fake_scenario("mixed_disks")
    end

    subject { fake_devicegraph }

    context "when it tries to copy into itself" do
      let(:other_devicegraph) { subject }

      it "does not perform the copy" do
        expect(subject).to_not receive(:copy)
        subject.safe_copy(other_devicegraph)
      end

      it "returns false" do
        expect(subject.safe_copy(other_devicegraph)).to eq(false)
      end
    end

    context "when it tries to copy into another devicegraph" do
      let(:other_devicegraph) do
        devicegraph = subject.dup
        disk = devicegraph.find_by_name("/dev/sda")
        disk.delete_partition_table
        devicegraph
      end

      it "performs the copy" do
        expect(subject).to_not eq(other_devicegraph)
        subject.safe_copy(other_devicegraph)
        expect(subject).to eq(other_devicegraph)
      end

      it "returns true" do
        expect(subject.safe_copy(other_devicegraph)).to eq(true)
      end
    end
  end

  describe "#check" do
    include Yast::Logger

    before do
      fake_scenario("mixed_disks")
    end

    subject { fake_devicegraph }

    it "runs the library checks with the corresping callbacks" do
      expect(subject).to receive(:storage_check).with(instance_of(Y2Storage::Callbacks::Check))

      subject.check
    end

    context "when the check raises an error" do
      before do
        allow(subject).to receive(:storage_check).and_raise(Storage::Exception, "check error")
      end

      it "logs the error" do
        expect(log).to receive(:error).with(/check error/)

        subject.check
      end
    end
  end

  describe "#actiongraph" do
    def with_sda2_deleted(initial_graph)
      graph = initial_graph.dup
      Y2Storage::Disk.find_by_name(graph, "/dev/sda").partition_table.delete_partition("/dev/sda2")
      graph
    end

    context "if both devicegraphs are equivalent" do
      before { Y2Storage::StorageManager.create_test_instance }

      let(:initial_graph) { Y2Storage::Devicegraph.new_from_file(input_file_for("mixed_disks")) }
      subject(:devicegraph) { initial_graph.dup }

      it "returns an empty actiongraph" do
        result = devicegraph.actiongraph(from: initial_graph)
        expect(result).to be_a Y2Storage::Actiongraph
        expect(result).to be_empty
      end
    end

    context "if both devicegraphs are not equivalent" do
      before { Y2Storage::StorageManager.create_test_instance }

      let(:initial_graph) { Y2Storage::Devicegraph.new_from_file(input_file_for("mixed_disks")) }
      subject(:devicegraph) { with_sda2_deleted(initial_graph) }

      it "returns an actiongraph with the needed actions" do
        result = devicegraph.actiongraph(from: initial_graph)
        expect(result).to be_a Y2Storage::Actiongraph
        expect(result).to_not be_empty
      end
    end

    context "if no initial devicegraph is provided" do
      before { fake_scenario("mixed_disks") }

      subject(:devicegraph) { with_sda2_deleted(fake_devicegraph) }

      it "uses the probed devicegraph as starting point" do
        probed = Y2Storage::StorageManager.instance.probed
        actiongraph1 = devicegraph.actiongraph(from: probed)
        actiongraph2 = devicegraph.actiongraph
        expect(actiongraph1.commit_actions_as_strings).to eq(actiongraph2.commit_actions_as_strings)
      end
    end
  end

  describe "#blk_filesystems" do
    before { fake_scenario("complex-lvm-encrypt") }
    subject(:list) { fake_devicegraph.blk_filesystems }
    let(:device_names) { list.map { |i| i.blk_devices.first.name } }

    it "returns a array of block filesystems" do
      expect(list).to be_a Array
      expect(list.map { |i| i.is?(:blk_filesystem) }).to all(be(true))
    end

    it "finds the filesystems on plain partitions" do
      expect(device_names).to include("/dev/sda1")
      expect(device_names).to include("/dev/sda2")
      expect(device_names).to include("/dev/sdf1")
    end

    it "finds the filesystems on encrypted partitions" do
      expect(device_names).to include("/dev/mapper/cr_sda4")
    end

    it "finds the filesystems on plain LVs" do
      expect(device_names).to include("/dev/vg0/lv1")
      expect(device_names).to include("/dev/vg0/lv2")
      expect(device_names).to include("/dev/vg1/lv1")
    end

    it "finds the filesystems on encrypted LVs" do
      expect(device_names).to include("/dev/mapper/cr_vg1_lv2")
    end
  end

  describe "#btrfs_filesystems" do
    before do
      fake_scenario("mixed_disks_btrfs")
    end

    let(:list) { fake_devicegraph.btrfs_filesystems }

    it "returns a array of Btrfs filesystems" do
      expect(list).to be_a(Array)
      expect(list.map { |i| i.is?(:btrfs) }).to all(be(true))
    end

    it "finds all the Btrfs filesystems" do
      expect(list.size).to eq(5)
    end
  end

  describe "#mount_points" do
    before do
      fake_scenario("complex-lvm-encrypt")
      fake_devicegraph.find_by_name("/dev/sda1").filesystem.create_mount_point("/mnt/windows")
      fake_devicegraph.find_by_name("/dev/mapper/cr_sda4").filesystem
        .create_mount_point("/mnt/data")
      fake_devicegraph.find_by_name("/dev/mapper/cr_vg1_lv2").filesystem
        .create_mount_point("/mnt/abc")
    end

    subject(:list) { fake_devicegraph.mount_points }
    let(:paths) { list.map(&:path) }

    it "returns a array of mount points" do
      expect(list).to be_a Array
      expect(list.map { |i| i.is?(:mount_point) }).to all(be(true))
    end

    it "finds the mount points on plain partitions" do
      expect(paths).to include("/mnt/windows")
    end

    it "finds the filesystems on encrypted partitions" do
      expect(paths).to include("/mnt/data")
    end

    it "finds the filesystems on plain LVs" do
      expect(paths).to include("/")
    end

    it "finds the filesystems on encrypted LVs" do
      expect(paths).to include("/mnt/abc")
    end

    context "in a btrfs setup" do
      before do
        fake_scenario("raid_efi")
      end

      it "finds the mount points on Btrfs subvolumes" do
        expect(paths).to include("/var/lib/mariadb")
        expect(paths).to include("/var/crash")
      end
    end
  end

  describe "#multidevice_btrfs_filesystems" do
    before do
      fake_scenario("btrfs2-devicegraph.xml")

      # Creates a new multi-device Btrfs
      sda2 = fake_devicegraph.find_by_name("/dev/sda2")
      sda3 = fake_devicegraph.find_by_name("/dev/sda3")
      sda3.remove_descendants
      sda2.filesystem.add_device(sda3)
    end

    let(:list) { fake_devicegraph.multidevice_btrfs_filesystems }

    it "returns a array of multi-device Btrfs filesystems" do
      expect(list).to be_a(Array)

      list.each { |f| expect(f.is?(:btrfs) && f.multidevice?).to eq(true) }
    end

    it "finds all multi-device Btrfs filesystems" do
      expect(list.size).to eq(2)
    end
  end

  describe "#tmp_filesystems" do
    before do
      Y2Storage::StorageManager.create_test_instance

      tmp1 = Y2Storage::Filesystems::Tmpfs.create(fake_devicegraph)
      tmp1.mount_path = "/mnt/tmp1"

      tmp2 = Y2Storage::Filesystems::Tmpfs.create(fake_devicegraph)
      tmp2.mount_path = "/mnt/tmp2"
    end

    subject(:list) { fake_devicegraph.tmp_filesystems }

    it "returns an array of tmp filesystems" do
      expect(list).to be_a Array
      expect(list.map { |i| i.is?(:tmpfs) }).to all(be(true))
    end

    it "finds all the tmp filesystems from the devicegraph" do
      expect(list.map(&:mount_path)).to contain_exactly("/mnt/tmp1", "/mnt/tmp2")
    end
  end

  describe "#filesystems" do
    before { fake_scenario("complex-lvm-encrypt") }
    subject(:list) { fake_devicegraph.filesystems }

    it "returns a array of filesystems" do
      expect(list).to be_a Array
      expect(list.map { |i| i.is?(:filesystem) }).to all(be(true))
    end

    it "finds all the filesystems" do
      expect(list.size).to eq 9
    end
  end

  describe "#lvm_pvs" do
    before { fake_scenario("complex-lvm-encrypt") }
    subject(:list) { fake_devicegraph.lvm_pvs }
    let(:device_names) { list.map { |i| i.blk_device.name } }

    it "returns a array of PVs" do
      expect(list).to be_a Array
      expect(list.map { |i| i.is?(:lvm_pv) }).to all(be(true))
    end

    it "finds the PVs on plain partitions" do
      expect(device_names).to include("/dev/sde2")
    end

    it "finds the PVs on encrypted partitions" do
      expect(device_names).to include("/dev/mapper/cr_sde1")
    end

    it "finds the PVs on plain disks" do
      expect(device_names).to include("/dev/sdg")
    end

    it "finds the PVs on encrypted disks" do
      expect(device_names).to include("/dev/mapper/cr_sdd")
    end
  end

  describe "#filesystem_in_network?" do
    before do
      allow(devicegraph).to receive(:filesystems).and_return([filesystem])
    end
    let(:blk_device) { Y2Storage::BlkDevice.find_by_name(devicegraph, dev_name) }
    let(:filesystem) { blk_device.blk_filesystem }
    let(:devicegraph) { Y2Storage::Devicegraph.new_from_file(input_file_for("mixed_disks")) }
    let(:dev_name) { "/dev/sdb2" }

    context "when filesystem is in network" do
      before do
        allow(filesystem).to receive(:in_network?).and_return(true)
      end

      it "returns true" do
        expect(devicegraph.filesystem_in_network?("/")).to eq true
      end
    end

    context "when filesystem is not in network" do
      before do
        allow(filesystem).to receive(:in_network?).and_return(false)
      end
      let(:devicegraph) { Y2Storage::Devicegraph.new_from_file(input_file_for("mixed_disks")) }

      it "returns false" do
        expect(devicegraph.filesystem_in_network?("/")).to eq false
      end
    end

    context "when mountpoint does not exist" do
      before do
        allow(filesystem).to receive(:in_network?).and_return(true)
      end
      let(:devicegraph) { Y2Storage::Devicegraph.new_from_file(input_file_for("mixed_disks")) }

      it "returns false" do
        expect(devicegraph.filesystem_in_network?("no_mountpoint")).to eq false
      end
    end
  end

  describe "#raids" do
    before do
      fake_scenario("mixed_disks")
    end

    subject(:devicegraph) { fake_devicegraph }

    context "when there are RAIDs" do
      before do
        Y2Storage::DmRaid.create(devicegraph, "/dev/mapper/imsm0")
        Y2Storage::DmRaid.create(devicegraph, "/dev/mapper/imsm1")

        Y2Storage::MdMember.create(devicegraph, "/dev/md0")
        Y2Storage::MdMember.create(devicegraph, "/dev/md/1")
        Y2Storage::MdMember.create(devicegraph, "/dev/md2")

        Y2Storage::Md.create(devicegraph, "/dev/md3")
        Y2Storage::Md.create(devicegraph, "/dev/md/4")
        Y2Storage::Md.create(devicegraph, "/dev/md5")
      end

      it "includes all RAIDs sorted by name" do
        expect(devicegraph.raids.map(&:name)).to eq [
          "/dev/mapper/imsm0",
          "/dev/mapper/imsm1",
          "/dev/md/1",
          "/dev/md/4",
          "/dev/md0",
          "/dev/md2",
          "/dev/md3",
          "/dev/md5"
        ]
      end
    end

    context "when there are no RAIDs" do
      it "does not include any device" do
        expect(devicegraph.raids).to be_empty
      end
    end
  end

  describe "#bios_raids" do
    before do
      fake_scenario("mixed_disks")
    end

    subject(:devicegraph) { fake_devicegraph }

    context "when there are BIOS RAIDs" do
      before do
        Y2Storage::DmRaid.create(devicegraph, "/dev/mapper/imsm0")
        Y2Storage::DmRaid.create(devicegraph, "/dev/mapper/imsm1")

        Y2Storage::MdMember.create(devicegraph, "/dev/md0")
        Y2Storage::MdMember.create(devicegraph, "/dev/md/1")
        Y2Storage::MdMember.create(devicegraph, "/dev/md2")
      end

      it "includes all DM RAIDs and BIOS MD RAIDs sorted by name" do
        expect(devicegraph.bios_raids.map(&:name)).to eq [
          "/dev/mapper/imsm0",
          "/dev/mapper/imsm1",
          "/dev/md/1",
          "/dev/md0",
          "/dev/md2"
        ]
      end
    end

    context "when there are not BIOS RAIDs" do
      before do
        Y2Storage::Md.create(devicegraph, "/dev/md/0")
      end

      it "does not include any device" do
        expect(devicegraph.bios_raids).to be_empty
      end
    end
  end

  describe "#software_raids" do
    before do
      fake_scenario("mixed_disks")
    end

    subject(:devicegraph) { fake_devicegraph }

    context "when there are Software RAIDs" do
      before do
        Y2Storage::Md.create(devicegraph, "/dev/md0")
        Y2Storage::Md.create(devicegraph, "/dev/md/1")
        Y2Storage::Md.create(devicegraph, "/dev/md2")
      end

      it "includes all Software RAIDs sorted by name" do
        expect(devicegraph.software_raids.map(&:name)).to eq [
          "/dev/md/1",
          "/dev/md0",
          "/dev/md2"
        ]
      end
    end

    context "when there are not Software RAIDs" do
      before do
        Y2Storage::MdMember.create(devicegraph, "/dev/md0")
      end

      it "does not include any device" do
        expect(devicegraph.software_raids).to be_empty
      end
    end
  end

  describe "#find_by_name" do
    before { fake_scenario("complex-lvm-encrypt") }
    subject(:devicegraph) { fake_devicegraph }

    context "there is BlkDevice with given name" do
      it "returns that device" do
        blk_device = devicegraph.find_by_name("/dev/sda1")

        expect(blk_device).to_not be_nil
        expect(blk_device.name).to eq "/dev/sda1"
      end
    end

    context "there is LvmVg with given name" do
      it "returns that device" do
        blk_device = devicegraph.find_by_name("/dev/vg0")

        expect(blk_device).to_not be_nil
        expect(blk_device.name).to eq "/dev/vg0"
      end
    end

    context "given name does not exists" do
      it "returns nil" do
        blk_device = devicegraph.find_by_name("/dev/drunk_chameleon")

        expect(blk_device).to be_nil
      end
    end
  end

  describe "#find_by_any_name" do
    before { fake_scenario("complex-lvm-encrypt") }
    subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    context "if there is BlkDevice with given name" do
      it "returns that device" do
        blk_device = devicegraph.find_by_any_name("/dev/sda1")

        expect(blk_device).to_not be_nil
        expect(blk_device.name).to eq "/dev/sda1"
      end

      it "does not perform a system lookup" do
        expect(Y2Storage::BlkDevice).to_not receive(:find_by_any_name)
        devicegraph.find_by_any_name("/dev/sda1")
      end
    end

    context "if there is LvmVg with given name" do
      it "returns that device" do
        blk_device = devicegraph.find_by_any_name("/dev/vg0")

        expect(blk_device).to_not be_nil
        expect(blk_device.name).to eq "/dev/vg0"
      end

      it "does not perform a system lookup" do
        expect(Y2Storage::BlkDevice).to_not receive(:find_by_any_name)
        devicegraph.find_by_any_name("/dev/vg0")
      end
    end

    context "if there is BlkDevice containing a filesystem with a matching UUID" do
      it "returns that device" do
        blk_device =
          devicegraph.find_by_any_name("/dev/disk/by-uuid/abcdefgh-ijkl-mnop-qrst-uvwxyzzz")

        expect(blk_device).to_not be_nil
        expect(blk_device.name).to eq "/dev/mapper/cr_vg1_lv2"
      end

      it "does not perform a system lookup" do
        expect(Y2Storage::BlkDevice).to_not receive(:find_by_any_name)
        devicegraph.find_by_any_name("/dev/mapper/cr_vg1_lv2")
      end
    end

    context "if there is BlkDevice containing a filesystem with a matching label" do
      it "returns that device" do
        blk_device = devicegraph.find_by_any_name("/dev/disk/by-label/root")

        expect(blk_device).to_not be_nil
        expect(blk_device.name).to eq "/dev/sda2"
      end

      it "does not perform a system lookup" do
        expect(Y2Storage::BlkDevice).to_not receive(:find_by_any_name)
        devicegraph.find_by_any_name("/dev/disk/by-label/root")
      end
    end

    context "if there is an Encryption with alternative name matching the given name" do
      before do
        encryption = devicegraph.find_by_name("/dev/mapper/cr_sda4")
        encryption.crypttab_name = "cr_home"
      end

      context "and the search is performed by using alternative names" do
        it "returns the correct encryption device" do
          blk_device = devicegraph.find_by_any_name("/dev/mapper/cr_home", alternative_names: true)

          expect(blk_device).to_not be_nil
          expect(blk_device.name).to eq "/dev/mapper/cr_sda4"
        end
      end

      context "and the search is not performed by using alternative names" do
        it "returns nil" do
          blk_device = devicegraph.find_by_any_name("/dev/mapper/cr_home", alternative_names: false)

          expect(blk_device).to be_nil
        end
      end
    end

    context "if no device is matched by its name or any of the known udev names" do
      let(:name) { "/dev/drunk_chameleon" }
      let(:raw_probed) { Y2Storage::StorageManager.instance.raw_probed }

      before do
        allow(Y2Storage::StorageManager.instance).to receive(:committed?).and_return committed
      end

      context "if the probed devicegraph is still up-to-date" do
        let(:committed) { false }

        it "performs a system lookup on the probed devicegraph" do
          # Use "be(raw_probed)" to ensure we are checking exactly on the raw_probed object.
          # Without that, the test would succeed for every devicegraph such that
          # devicegraph == raw_probed. But being equal is not enough, libstorage-ng raises
          # an exception if a lookup is attempted in any other devicegraph.
          expect(Y2Storage::BlkDevice).to receive(:find_by_any_name).with(be(raw_probed), name)
          devicegraph.find_by_any_name(name)
        end

        context "if the lookup returns a valid probed device" do
          let(:probed_device) { fake_devicegraph.find_by_name("/dev/sdf1") }

          before do
            allow(Y2Storage::BlkDevice).to receive(:find_by_any_name).and_return probed_device
          end

          context "and that device still exists in the target devicegraph" do
            it "returns the corresponding device" do
              found = devicegraph.find_by_any_name(name)
              expected = devicegraph.find_by_name("/dev/sdf1")
              expect(found).to eq expected
            end
          end

          context "and there is no equivalent device in the target devicegraph" do
            before do
              partition = devicegraph.find_by_name("/dev/sdf1")
              partition.partition_table.delete_partition(partition)
            end

            it "returns nil" do
              found = devicegraph.find_by_any_name(name)
              expect(found).to be_nil
            end
          end
        end

        context "if the lookup finds nothing" do
          before do
            allow(Y2Storage::BlkDevice).to receive(:find_by_any_name).and_return nil
          end

          it "returns nil" do
            expect(devicegraph.find_by_any_name(name)).to be_nil
          end
        end
      end

      context "if the probed devicegraph may be outdated" do
        let(:committed) { true }

        it "returns nil" do
          expect(devicegraph.find_by_any_name(name)).to be_nil
        end

        it "does not perform a system lookup" do
          expect(Y2Storage::BlkDevice).to_not receive(:find_by_any_name)
          devicegraph.find_by_any_name(name)
        end
      end
    end
  end

  describe "#disk_devices" do
    before { fake_scenario(scenario) }
    subject(:graph) { fake_devicegraph }

    context "if there are no multi-disk devices" do
      let(:scenario) { "autoyast_drive_examples" }

      it "returns an array of devices" do
        expect(graph.disk_devices).to be_an Array
        expect(graph.disk_devices).to all(be_a(Y2Storage::Device))
      end

      it "includes all partitionable disks and DASDs sorted by name" do
        expect(graph.disk_devices.map(&:name)).to eq [
          "/dev/dasda", "/dev/dasdb", "/dev/nvme0n1", "/dev/sda", "/dev/sdb",
          "/dev/sdc", "/dev/sdd", "/dev/sdf", "/dev/sdh", "/dev/sdi", "/dev/sdj", "/dev/sdaa"
        ]
      end
    end

    context "if there are multipath devices" do
      let(:scenario) { "empty-dasd-and-multipath.xml" }

      it "returns a sorted array of devices" do
        devices = graph.disk_devices
        expect(devices).to be_an Array
        expect(devices).to all(be_a(Y2Storage::Device))
        expect(devices).to all(satisfy { |dev| less_than_next?(dev, devices) })
      end

      it "includes all multipath devices" do
        expect(graph.disk_devices.map(&:name)).to include(
          "/dev/mapper/36005076305ffc73a00000000000013b4",
          "/dev/mapper/36005076305ffc73a00000000000013b5"
        )
      end

      it "includes all disks and DASDs that are not part of a multipath" do
        expect(graph.disk_devices.map(&:name)).to include("/dev/dasdb", "/dev/sde")
      end

      it "does not include individual disks and DASDs from the multipaths" do
        expect(graph.disk_devices.map(&:name)).to_not include(
          "/dev/sda", "/dev/sdb", "/dev/sdc", "/dev/sdd"
        )
      end
    end

    context "if there are DM RAIDs" do
      let(:scenario) { "empty-dm_raids.xml" }

      it "returns a sorted array of devices" do
        devices = graph.disk_devices
        expect(devices).to be_an Array
        expect(devices).to all(be_a(Y2Storage::Device))
        expect(devices).to all(satisfy { |dev| less_than_next?(dev, devices) })
      end

      it "includes all DM RAIDs" do
        expect(graph.disk_devices.map(&:name)).to include(
          "/dev/mapper/isw_ddgdcbibhd_test1", "/dev/mapper/isw_ddgdcbibhd_test2"
        )
      end

      it "includes all disks and DASDs that are not part of a DM RAID" do
        expect(graph.disk_devices.map(&:name)).to include("/dev/sda")
      end

      it "does not include individual disks or DASDs from the DM RAID" do
        expect(graph.disk_devices.map(&:name)).to_not include("/dev/sdb", "/dev/sdc")
      end
    end

    context "if there are MD Member RAIDs" do
      let(:scenario) { "md-imsm1-devicegraph.xml" }

      it "returns a sorted array of devices" do
        devices = graph.disk_devices
        expect(devices).to be_an Array
        expect(devices).to all(be_a(Y2Storage::Device))
        expect(devices).to all(satisfy { |dev| less_than_next?(dev, devices) })
      end

      it "includes all MD Member RAIDs" do
        expect(graph.disk_devices.map(&:name)).to include(
          "/dev/md/a", "/dev/md/b"
        )
      end

      it "includes all disks and DASDs that are not part of a MD Member RAID" do
        expect(graph.disk_devices.map(&:name)).to include("/dev/sda")
      end

      it "does not include individual disks or DASDs from the MD Member RAID" do
        expect(graph.disk_devices.map(&:name))
          .to_not include("/dev/sdb", "/dev/sdc", "/dev/sdd")
      end
    end

    context "if there are several kind of DASDs" do
      let(:scenario) { "kinds-of-dasd.xml" }

      it "returns a sorted array of devices" do
        devices = graph.disk_devices
        expect(devices).to be_an Array
        expect(devices).to all(be_a(Y2Storage::Device))
        expect(devices).to all(satisfy { |dev| less_than_next?(dev, devices) })
      end

      it "includes all disks and DASDs that can hold a partition table" do
        expect(graph.disk_devices.map(&:name)).to include(
          "/dev/sda", "/dev/dasda", "/dev/dasdc", "/dev/dasdd", "/dev/dasde"
        )
      end

      it "does not include unformatted DASDs" do
        expect(graph.disk_devices.map(&:name)).to_not include("/dev/dasdb")
      end
    end

    context "if there are zero-size devices" do
      let(:scenario) { "zero-size_disk" }

      it "does not include zero-size devices" do
        expect(graph.disks).to include(an_object_having_attributes(name: "/dev/sda"))
        expect(graph.disk_devices).to_not include(an_object_having_attributes(name: "/dev/sda"))
      end
    end
  end

  describe "#remove_bcache" do
    subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    before do
      fake_scenario("bcache1.xml")
    end

    let(:bcache_name) { "/dev/bcache2" }

    it "removes the given bcache device" do
      bcache = Y2Storage::Bcache.find_by_name(devicegraph, bcache_name)
      expect(bcache).to_not be_nil

      devicegraph.remove_bcache(bcache)

      bcache = Y2Storage::Bcache.find_by_name(devicegraph, bcache_name)
      expect(bcache).to be_nil
    end

    it "removes all bcache descendants" do
      bcache = Y2Storage::Bcache.find_by_name(devicegraph, bcache_name)
      descendants_sid = bcache.descendants.map(&:sid)

      expect(descendants_sid).to_not be_empty

      devicegraph.remove_bcache(bcache)

      existing_descendants = descendants_sid.map { |sid| devicegraph.find_device(sid) }.compact
      expect(existing_descendants).to be_empty
    end

    it "removes the no longer used bcache csets" do
      bcache = Y2Storage::Bcache.find_by_name(devicegraph, bcache_name)

      expect(devicegraph.bcache_csets).to_not be_empty
      devicegraph.remove_bcache(bcache)
      # still in use
      expect(devicegraph.bcache_csets).to_not be_empty
      devicegraph.bcaches.each do |bcache_device|
        devicegraph.remove_bcache(bcache_device)
      end
      expect(devicegraph.bcache_csets).to be_empty
    end

    context "when the bcache does not exist in the devicegraph" do
      before do
        Y2Storage::Bcache.create(other_devicegraph, bcache1_name)
      end

      let(:other_devicegraph) { devicegraph.dup }

      let(:bcache1_name) { "/dev/bcache10" }

      it "raises an exception and does not remove the bcache" do
        bcache1 = Y2Storage::Bcache.find_by_name(other_devicegraph, bcache1_name)

        expect { devicegraph.remove_bcache(bcache1) }.to raise_error(ArgumentError)
        expect(Y2Storage::Bcache.find_by_name(other_devicegraph, bcache1_name)).to_not be_nil
      end
    end
  end

  describe "#remove_bcache_cset" do
    subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    before do
      fake_scenario("bcache1.xml")
    end

    it "removes the given caching set device" do
      bcache_cset = Y2Storage::BcacheCset.all(devicegraph).first
      expect(bcache_cset).to_not be_nil

      sid = bcache_cset.sid

      devicegraph.remove_bcache_cset(bcache_cset)

      expect(devicegraph.find_device(sid)).to be_nil
    end
  end

  describe "#remove_btrfs_subvolume" do
    subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    before do
      fake_scenario("mixed_disks_btrfs")
      btrfs.quota = true
    end

    let(:btrfs) { devicegraph.find_by_name("/dev/sda2").filesystem }

    it "removes the given subvolume" do
      subvol = btrfs.find_btrfs_subvolume_by_path("@/srv")
      expect(subvol).to_not be_nil

      devicegraph.remove_btrfs_subvolume(subvol)

      subvol = btrfs.find_btrfs_subvolume_by_path("@/srv")
      expect(subvol).to be_nil
    end

    it "removes the corresponding qgroup" do
      subvol = btrfs.find_btrfs_subvolume_by_path("@/srv")
      qgroups = btrfs.btrfs_qgroups.size

      devicegraph.remove_btrfs_subvolume(subvol)

      expect(btrfs.btrfs_qgroups.size).to eq(qgroups - 1)
    end
  end

  describe "#remove_md" do
    subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    before do
      fake_scenario("md_raid")

      # Create a Vg over the md raid
      md = Y2Storage::Md.find_by_name(devicegraph, md_name)
      md.remove_descendants

      vg = Y2Storage::LvmVg.create(devicegraph, vg_name)
      vg.add_lvm_pv(md)

      sda3.remove_descendants
      vg.add_lvm_pv(sda3)

      vg.create_lvm_lv("lv1", Y2Storage::DiskSize.GiB(1))
    end

    let(:md_name) { "/dev/md/md0" }
    let(:vg_name) { "vg0" }
    let(:sda3) { devicegraph.find_by_name("/dev/sda3") }

    it "removes the given md device" do
      md = Y2Storage::Md.find_by_name(devicegraph, md_name)
      expect(md).to_not be_nil

      devicegraph.remove_md(md)

      md = Y2Storage::Md.find_by_name(devicegraph, md_name)
      expect(md).to be_nil
    end

    it "removes all md descendants" do
      md = Y2Storage::Md.find_by_name(devicegraph, md_name)
      descendants_sid = md.descendants.map(&:sid)

      expect(descendants_sid).to_not be_empty

      devicegraph.remove_md(md)

      existing_descendants = descendants_sid.map { |sid| devicegraph.find_device(sid) }.compact
      expect(existing_descendants).to be_empty
    end

    it "removes the orphans resulting from deleting the descendants" do
      md = Y2Storage::Md.find_by_name(devicegraph, md_name)

      expect(sda3.lvm_pv).to_not be_nil
      devicegraph.remove_md(md)
      expect(sda3.lvm_pv).to be_nil
    end

    it "does not remove other devices" do
      md = Y2Storage::Md.find_by_name(devicegraph, md_name)

      expect(sda3.exists_in_devicegraph?(devicegraph)).to eq true
      devicegraph.remove_md(md)
      expect(sda3.exists_in_devicegraph?(devicegraph)).to eq true
    end

    context "when the md does not exist in the devicegraph" do
      before do
        Y2Storage::Md.create(other_devicegraph, md1_name)
      end

      let(:other_devicegraph) { devicegraph.dup }

      let(:md1_name) { "/dev/md/md1" }

      it "raises an exception and does not remove the md" do
        md1 = Y2Storage::Md.find_by_name(other_devicegraph, md1_name)

        expect { devicegraph.remove_md(md1) }.to raise_error(ArgumentError)
        expect(Y2Storage::Md.find_by_name(other_devicegraph, md1_name)).to_not be_nil
      end
    end
  end

  describe "#remove_lvm_vg" do
    subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:vg_name) { "/dev/vg1" }

    before { fake_scenario("lvm-two-vgs") }

    it "removes the given LvmVg device" do
      vg = devicegraph.find_by_name(vg_name)

      expect(vg).to_not be_nil
      devicegraph.remove_lvm_vg(vg)
      expect(devicegraph.find_by_name(vg_name)).to be_nil
    end

    it "removes all VG descendants" do
      vg = devicegraph.find_by_name(vg_name)
      descendants_sid = vg.descendants.map(&:sid)

      expect(descendants_sid).to_not be_empty
      devicegraph.remove_lvm_vg(vg)

      survivors = descendants_sid.map { |sid| devicegraph.find_device(sid) }.compact
      expect(survivors).to be_empty
    end

    it "removes all the LvmPv devices associated to the VG" do
      vg = devicegraph.find_by_name(vg_name)
      pv_sids = vg.lvm_pvs.map(&:sid)

      expect(pv_sids).to_not be_empty
      devicegraph.remove_lvm_vg(vg)
      surviving_pvs = pv_sids.map { |sid| devicegraph.find_device(sid) }.compact
      expect(surviving_pvs).to be_empty
    end

    it "does not remove the block devices hosting the PVs" do
      vg = devicegraph.find_by_name(vg_name)
      blk_devices = vg.lvm_pvs.map(&:blk_device)

      expect(blk_devices).to_not be_empty
      devicegraph.remove_lvm_vg(vg)
      surviving_devs = blk_devices.map { |dev| devicegraph.find_device(dev.sid) }
      expect(surviving_devs).to eq blk_devices
    end

    context "when the VG does not exist in the devicegraph" do
      let(:other_devicegraph) { devicegraph.dup }
      let(:new_vg_name) { "new_vg" }

      before do
        Y2Storage::LvmVg.create(other_devicegraph, new_vg_name)
      end

      it "raises an exception and does not remove the VG" do
        vg = Y2Storage::LvmVg.find_by_vg_name(other_devicegraph, new_vg_name)

        expect { devicegraph.remove_lvm_vg(vg) }.to raise_error ArgumentError
        expect(Y2Storage::LvmVg.find_by_vg_name(other_devicegraph, new_vg_name)).to_not be_nil
      end
    end
  end

  describe "#remove_tmpfs" do
    subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    before do
      fake_scenario(scenario)
    end

    context "when the given device is a Tmpfs fileystem" do
      let(:scenario) { "tmpfs1-devicegraph.xml" }

      let(:device) do
        devicegraph.tmp_filesystems.find { |i| i.mount_path == "/test1" }
      end

      it "removes the given Tmpfs filesystem" do
        expect(device).to_not be_nil

        sid = device.sid
        devicegraph.remove_tmpfs(device)

        expect(devicegraph.find_device(sid)).to be_nil
      end

      it "removes all the Tmpfs descendants" do
        descendants_sid = device.descendants.map(&:sid)
        expect(descendants_sid).to_not be_empty

        devicegraph.remove_tmpfs(device)

        existing_descendants = descendants_sid.map { |sid| devicegraph.find_device(sid) }.compact
        expect(existing_descendants).to be_empty
      end
    end

    context "when the given device is not a Tmpfs filesystem" do
      let(:scenario) { "mixed_disks" }

      let(:device) { devicegraph.find_by_name("/dev/sda1") }

      it "raises an exception and does not remove the given device" do
        expect { devicegraph.remove_tmpfs(device) }.to raise_error(ArgumentError)

        expect(devicegraph.find_by_name("/dev/sda1")).to_not be_nil
      end
    end
  end

  describe "#to_xml" do
    before { fake_scenario("empty_hard_disk_50GiB") }

    subject(:devicegraph) { fake_devicegraph }

    it "returns a string" do
      expect(devicegraph.to_xml).to be_a(String)
    end

    it "contains the xml representation of the devicegraph" do
      expect(devicegraph.to_xml).to match(/^<\?xml/)
      expect(devicegraph.to_xml.scan(/<Disk>/).size).to eq(1)
      expect(devicegraph.to_xml.scan(/<Partition>/).size).to eq(0)

      create_next_partition(devicegraph.disks.first)

      expect(devicegraph.to_xml.scan(/<Partition>/).size).to eq(1)
    end
  end

  describe "#blk_devices" do
    before do
      fake_scenario("complex-lvm-encrypt")
      Y2Storage::StrayBlkDevice.create(fake_devicegraph, "/dev/xvda3")
    end

    subject(:list) { fake_devicegraph.blk_devices }

    it "returns a sorted array of block devices" do
      expect(list).to be_a Array
      expect(list).to all(be_a(Y2Storage::BlkDevice))
      expect(list).to all(satisfy { |dev| less_than_next?(dev, list) })
    end

    it "finds all the devices" do
      expect(list.size).to eq 25
    end

    it "does not include other devices like volume groups" do
      expect(fake_devicegraph.lvm_vgs).to_not be_empty
      vg1 = fake_devicegraph.lvm_vgs.first
      expect(list).to_not include vg1
    end
  end

  describe "#bcaches" do
    before do
      fake_scenario("bcache1.xml")
    end

    subject(:list) { fake_devicegraph.bcaches }

    it "returns an array of bcache devices" do
      expect(list).to be_a Array
      expect(list).to all(be_a(Y2Storage::Bcache))
    end

    it "finds all the devices" do
      expect(list.size).to eq(3), "found devices: #{list.inspect}"
    end

    it "does not include other devices like volume groups" do
      expect(fake_devicegraph.lvm_vgs).to_not be_empty
      vg1 = fake_devicegraph.lvm_vgs.first
      expect(list).to_not include vg1
    end
  end

  describe "#bcache_csets" do
    before do
      fake_scenario("bcache1.xml")
    end

    subject(:list) { fake_devicegraph.bcache_csets }

    it "returns an array of bcache csets" do
      expect(list).to be_a Array
      expect(list).to all(be_a(Y2Storage::BcacheCset))
    end

    it "finds all the devices" do
      expect(list.size).to eq 1
    end

    it "does not include other devices like volume groups" do
      expect(fake_devicegraph.lvm_vgs).to_not be_empty
      vg1 = fake_devicegraph.lvm_vgs.first
      expect(list).to_not include vg1
    end
  end

  describe "#stray_blk_devices" do
    before do
      fake_scenario("mixed_disks")
    end

    subject(:devicegraph) { fake_devicegraph }

    context "when there are virtual partitions" do
      before do
        Y2Storage::StrayBlkDevice.create(devicegraph, "/dev/xvda3")
        Y2Storage::StrayBlkDevice.create(devicegraph, "/dev/xvda1")
      end

      it "returns all virtual partitions sorted by name" do
        expect(devicegraph.stray_blk_devices.map(&:name)).to eq ["/dev/xvda1", "/dev/xvda3"]
      end
    end

    context "when there are no virtual partitions" do
      it "does not include any device" do
        expect(devicegraph.stray_blk_devices).to be_empty
      end
    end
  end

  describe "#inspect" do
    context "when some devices are not supported by YamlWriter" do
      before do
        fake_scenario("empty-dm_raids.xml")
        fs = Y2Storage::Filesystems::Nfs.create(fake_devicegraph, "server", "/path")
        fs.create_mount_point("/nfs_mount")
      end

      it "includes warnings about the ommitted information" do
        expect(fake_devicegraph.inspect).to include(
          "[\"unsupported_device\", [[\"name\", \"/dev/mapper/isw_ddgdcbibhd_test1\"]"
        )
        expect(fake_devicegraph.inspect).to include(
          "[\"unsupported_device\", [[\"name\", \"server:/path\"]"
        )
      end
    end

    context "when the devicegraph contains encrypted devices" do
      subject(:devicegraph) { Y2Storage::StorageManager.instance.staging }

      before do
        Y2Storage::StorageManager.create_test_instance
        disk = Y2Storage::Disk.create(devicegraph, "/dev/sda")
        disk.size = Y2Storage::DiskSize.GiB(10)
        encryption = disk.create_encryption("cr_data")
        encryption.password = "s3cr3t"
      end

      it "does not include the encryption password" do
        expect(devicegraph.inspect).to include "/dev/mapper/cr_data"
        expect(devicegraph.inspect).to_not include "s3cr3t"
      end
    end
  end

  describe "#used_features" do
    before { fake_scenario(scenario) }

    context "with local devices combining several filesystem types" do
      let(:scenario) { "mixed_disks" }

      it "returns the expected set of storage features" do
        features = fake_devicegraph.used_features
        expect(features).to be_a Y2Storage::StorageFeaturesList
        expect(features.map(&:id))
          .to contain_exactly(:UF_BTRFS, :UF_EXT4, :UF_NTFS, :UF_XFS, :UF_SWAP)
      end

      it "returns only the features for mounted filesystems if required_only is given" do
        features = fake_devicegraph.used_features(required_only: true)
        expect(features).to be_a Y2Storage::StorageFeaturesList
        expect(features.map(&:id))
          .to contain_exactly(:UF_BTRFS, :UF_XFS, :UF_SWAP)
      end

      context "if YaST needs some extra feature to configure a device" do
        before do
          sda2 = fake_devicegraph.find_by_name("/dev/sda2")
          sda2.encrypt(method: Y2Storage::EncryptionMethod::TPM_FDE)
        end

        it "returns the expected set of features" do
          features = fake_devicegraph.used_features
          expect(features).to be_a Y2Storage::StorageFeaturesList
          expect(features.map(&:id))
            .to contain_exactly(
              :UF_BTRFS, :UF_EXT4, :UF_NTFS, :UF_XFS, :UF_SWAP, :UF_LUKS, :encryption_tpm_fde
            )
        end
      end
    end

    context "with unformatted DASD and FC devices" do
      let(:scenario) { "empty-dasd-and-multipath.xml" }

      it "returns the expected set of storage features" do
        features = fake_devicegraph.used_features
        expect(features).to be_a Y2Storage::StorageFeaturesList
        expect(features.map(&:id)).to contain_exactly(:UF_DASD, :UF_FC, :UF_FCOE, :UF_MULTIPATH)
      end
    end
  end

  describe "#required_used_features" do
    before { fake_scenario(scenario) }

    context "with local devices combining several filesystem types" do
      let(:scenario) { "mixed_disks" }

      it "returns only the features for mounted filesystems" do
        features = fake_devicegraph.required_used_features
        expect(features).to be_a Y2Storage::StorageFeaturesList
        expect(features.map(&:id))
          .to contain_exactly(:UF_BTRFS, :UF_XFS, :UF_SWAP)
      end
    end

    context "with an empty disk" do
      let(:scenario) { "empty_disks" }

      it "Survives not having any storage features" do
        features = fake_devicegraph.required_used_features
        expect(features).to be_a Y2Storage::StorageFeaturesList
        expect(features.map(&:id)).to be == []
      end
    end
  end

  describe "#optional_used_features" do
    before { fake_scenario(scenario) }

    context "with local devices combining several filesystem types" do
      let(:scenario) { "mixed_disks" }

      it "returns only the features for filesystems that are not mounted" do
        features = fake_devicegraph.optional_used_features
        expect(features).to be_a Y2Storage::StorageFeaturesList
        expect(features.map(&:id))
          .to contain_exactly(:UF_EXT4, :UF_NTFS)
      end
    end

    context "with an empty disk" do
      let(:scenario) { "empty_disks" }

      it "Survives not having any storage features" do
        features = fake_devicegraph.optional_used_features
        expect(features).to be_a Y2Storage::StorageFeaturesList
        expect(features.map(&:id)).to be == []
      end
    end
  end
end
