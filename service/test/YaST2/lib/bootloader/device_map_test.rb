# frozen_string_literal: true

# Vendored from yast2-bootloader's test/device_map_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/device_map"

describe Bootloader::DeviceMap do
  include_context "yast2-bootloader test setup"

  subject { Bootloader::DeviceMap.new }

  describe "#propose" do
    before do
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      mock_disk_partition
      target_map_stub("storage_mdraid.yaml")
    end

    xit "fills itself with device map proposal" do
      subject.propose
      expect(subject).to_not be_empty
    end

    xit "propose always empty map in Mode config" do
      allow(Yast::Mode).to receive(:config).and_return(true)

      subject.propose
      expect(subject).to be_empty
    end

    # TODO: I do not have sufficient target map yet
    it "do not add to device map members of raids and multipath"

    xit "do not add non-disk devices" do
      target_map_stub("storage_tmpfs.yaml")

      subject.propose
      expect(subject.grub_device_for("/dev/tmpfs")).to eq nil
    end

    # TODO: I do not have sufficient target map yet with enough disks and mixture of bios ids
    it "propose order according to bios id"

    # TODO: I do not have sufficient target map yet
    it "do not propose USB as first device"

    # TODO: I do not have sufficient target map yet with enough disks and mixture of bios ids
    it "propose as first device disk containing /boot"

    xit "limits number of disks in device map to 8" do
      # simple mock getting disks from partition as it need initialized libstorage
      mock_disk_partition

      target_map_stub("many_disks.yaml")

      subject.propose
      expect(subject.size).to eq 8
    end
  end

  describe "#disks_order" do
    it "returns disks in device sorted by id" do
      map = Bootloader::DeviceMap.new
      map.add_mapping("hd0", "/dev/vdb")
      map.add_mapping("hd2", "/dev/vda")
      map.add_mapping("hd1", "/dev/vdc")

      expect(map.disks_order).to eq(["/dev/vdb", "/dev/vdc", "/dev/vda"])
    end
  end

  describe "#contain_disk?" do
    before do
      allow(Bootloader::UdevMapping).to receive(:to_mountby_device)
        .and_return("/dev/bla")
    end

    it "checks if device map contain passed disk" do
      map = Bootloader::DeviceMap.new
      map.add_mapping("hd0", "/dev/vdb")
      map.add_mapping("hd2", "/dev/vda")
      map.add_mapping("hd1", "/dev/vdc")

      expect(map.contain_disk?("/dev/vdb")).to be true
      expect(map.contain_disk?("/dev/vdd")).to be false
    end

    it "try also device in format for mountby" do
      map = Bootloader::DeviceMap.new
      map.add_mapping("hd0", "/dev/bla")

      expect(map.contain_disk?("/dev/bla")).to be true
    end
  end
end
