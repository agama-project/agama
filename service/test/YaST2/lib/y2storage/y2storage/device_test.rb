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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage"

describe Y2Storage::Device do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  before do
    fake_scenario(scenario)
  end

  let(:scenario) { "complex-lvm-encrypt" }

  describe "#ancestors" do
    subject(:device) { Y2Storage::LvmLv.find_by_name(fake_devicegraph, "/dev/vg0/lv1").blk_filesystem }

    it "does not include the device itself" do
      expect(device.ancestors.map(&:sid)).to_not include device.sid
    end

    it "includes all the ancestors" do
      expect(device.ancestors.size).to eq 10
    end

    it "returns objects of the right classes" do
      all = device.ancestors
      expect(all.select { |i| i.is?(:lvm_lv) }.size).to eq 1
      expect(all.select { |i| i.is?(:lvm_vg) }.size).to eq 1
      expect(all.select { |i| i.is?(:lvm_pv) }.size).to eq 2
      expect(all.select { |i| i.is?(:encryption) }.size).to eq 2
      expect(all.select { |i| i.is?(:partition) }.size).to eq 1
      expect(all.select { |i| i.is?(:disk) }.size).to eq 2
      expect(all.select { |i| i.is?(:partition_table) }.size).to eq 1
    end
  end

  describe "#descendants" do
    subject(:device) { Y2Storage::Disk.find_by_name(fake_devicegraph, "/dev/sda") }

    it "does not include the device itself" do
      expect(device.descendants.map(&:sid)).to_not include device.sid
    end

    it "includes all the descendants" do
      expect(device.descendants.size).to eq 9
    end

    it "returns objects of the right classes" do
      all = device.descendants
      expect(all.select { |i| i.is?(:partition_table) }.size).to eq 1
      expect(all.select { |i| i.is?(:partition) }.size).to eq 4
      expect(all.select { |i| i.is?(:filesystem) }.size).to eq 3
      expect(all.select { |i| i.is?(:encryption) }.size).to eq 1
    end
  end

  describe "#siblings" do
    subject(:device) { Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1") }

    it "does not include the device itself" do
      expect(device.siblings.map(&:sid)).to_not include device.sid
    end

    it "includes all the siblings" do
      expect(device.siblings.map(&:name)).to contain_exactly("/dev/sda2", "/dev/sda3", "/dev/sda4")
    end

    it "returns objects of the right classes" do
      expect(device.siblings).to all(be_a(Y2Storage::Partition))
    end
  end

  describe "#copy_to" do
    let(:scenario) { "btrfs-multidevice-over-partitions.xml" }

    let(:initial_devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:target_devicegraph) { initial_devicegraph.dup }

    before do
      # Creating a new disk to be able to distinguish initial and target devicegraphs easily
      Y2Storage::Disk.create(target_devicegraph, "/dev/sdc", 10.GiB)
    end

    context "when the device already exists in the target devicegraph" do
      subject(:device) { initial_devicegraph.find_by_name("/dev/sda1") }

      it "returns the device from the target devicegraph" do
        existing_device = target_devicegraph.find_device(device.sid)

        copied_device = device.copy_to(target_devicegraph)

        expect(copied_device).to eq(existing_device)
        expect(copied_device.devicegraph).to eq(target_devicegraph)
      end
    end

    context "when the device does not exist in the target devicegraph" do
      subject(:device) { initial_devicegraph.find_by_name("/dev/sda1").filesystem }

      before do
        sda1 = target_devicegraph.find_by_name("/dev/sda1")
        sda1.delete_filesystem
      end

      context "and all parents exist in the target devicegraph" do
        it "returns the device copied to the target devicegraph" do
          expect(target_devicegraph.find_device(device.sid)).to be_nil

          copied_device = device.copy_to(target_devicegraph)

          expect(copied_device).to eq(device)
          expect(copied_device.devicegraph).to eq(target_devicegraph)
        end

        it "copies all parents correctly" do
          copied_device = device.copy_to(target_devicegraph)

          expect(copied_device.parents.map(&:sid).sort).to eq(device.parents.map(&:sid).sort)
        end
      end

      context "and any parent is missing in the target devicegraph" do
        before do
          sda1 = target_devicegraph.find_by_name("/dev/sda1")
          sda1.partition_table.delete_partition(sda1)
        end

        it "raises an exception" do
          expect { device.copy_to(target_devicegraph) }.to raise_error(Storage::Exception)
        end
      end
    end
  end

  describe "#can_resize?" do
    subject(:device) { Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1") }
    let(:resize_info) do
      double(Y2Storage::ResizeInfo, resize_ok?: resize_ok,
        reasons: 0, reason_texts: [])
    end

    before { allow(device).to receive(:storage_detect_resize_info).and_return resize_info }

    context "if not in test mode and libstorage-ng reports that resizing is possible" do
      let(:resize_ok) { true }

      it "invokes the corresponding libstorage-ng method" do
        expect(device).to receive(:storage_detect_resize_info)
        device.can_resize?
      end

      it "returns true" do
        expect(device.can_resize?).to eq true
      end
    end

    context "if not in test mode and libstorage-ng reports that resizing is not possible" do
      let(:resize_ok) { false }

      it "invokes the corresponding libstorage-ng method" do
        expect(device).to receive(:storage_detect_resize_info)
        device.can_resize?
      end

      it "returns false" do
        expect(device.can_resize?).to eq false
      end
    end

    context "if in test mode" do
      before { allow(Y2Storage::StorageEnv.instance).to receive(:test_mode?).and_return(true) }
      let(:resize_ok) { true }

      it "does not check with libstorage-ng" do
        expect(device).to_not receive(:storage_detect_resize_info)
        device.can_resize?
      end

      it "returns false" do
        expect(device.can_resize?).to eq false
      end
    end
  end

  describe "#hash" do
    it "returns same result for same devices that are independently found" do
      expect(
        Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1").hash
      ).to(eq(
             Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1").hash
           ))

    end
  end

  describe "#eql?" do
    it "returns true for same devices that are independently found" do
      expect(
        Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1").eql?(
          Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1")
        )
      ).to eq true
    end

    it "allows correct array subtracting" do
      arr1 = [
        Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1"),
        Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda2")
      ]
      arr2 = [
        Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1"),
        Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sde1")
      ]

      expect(arr1 - arr2).to eq([Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda2")])
    end

    it "returns false if compared different classes" do
      expect(Y2Storage::Partition.find_by_name(fake_devicegraph, "/dev/sda1").eql?(nil)).to eq false
    end
  end

  describe "#exists_in_probed?" do
    let(:scenario) { "lvm-errors1-devicegraph.xml" }

    subject(:device) { devicegraph.find_by_name(device_name) }

    context "if the device exists in probed devicegraph" do
      let(:devicegraph) { Y2Storage::StorageManager.instance.raw_probed }

      let(:device_name) { "/dev/sdb1" }

      it "returns true" do
        expect(device.exists_in_probed?).to eq(true)
      end
    end

    context "if the device does not exist in probed devicegraph" do
      let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

      let(:device_name) { "/dev/md1" }

      before do
        Y2Storage::Md.create(devicegraph, device_name)
      end

      it "returns false" do
        expect(device.exists_in_probed?).to eq(false)
      end
    end

    context "if the device exists in raw probed but not in probed" do
      let(:devicegraph) { Y2Storage::StorageManager.instance.raw_probed }

      let(:device_name) { "/dev/test1" }

      it "returns false" do
        expect(device.exists_in_raw_probed?).to eq(true)
        expect(device.exists_in_probed?).to eq(false)
      end
    end
  end

  describe "#display_name" do
    let(:device) { devicegraph.find_by_name(device_name) }

    let(:devicegraph) { Y2Storage::StorageManager.instance.staging }

    let(:scenario) { "mixed_disks" }

    context "if the device has name" do
      subject { device }

      let(:device_name) { "/dev/sda" }

      it "returns the device name" do
        expect(subject.display_name).to eq(device_name)
      end
    end

    context "if the device has no name" do
      subject { device.filesystem }

      let(:device_name) { "/dev/sda1" }

      it "returns nil" do
        expect(subject.display_name).to be_nil
      end
    end
  end
end
