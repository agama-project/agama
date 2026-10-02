# frozen_string_literal: true

# Vendored from yast2-bootloader's test/mbr_update_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/mbr_update"
require "bootloader/stage1"

Yast.import "BootStorage"

describe Bootloader::MBRUpdate do
  include_context "yast2-bootloader test setup"

  subject { Bootloader::MBRUpdate.new }

  def stage1(devices: [], activate: false, generic_mbr: false)
    stage1 = Bootloader::Stage1.new

    devices.each { |d| stage1.model.add_device(d) }
    stage1.activate = activate
    stage1.generic_mbr = generic_mbr

    stage1
  end

  describe "#run" do
    before do
      # by default common architecture"
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      # do not crash in report if some script failed
      allow(Yast::Report).to receive(:Error)
    end

    # FIXME: get reason for it
    it "creates backup for all devices in stage1" do
      devicegraph_stub("two_disks.yaml")

      backup_mock = double(::Bootloader::BootRecordBackup)
      expect(backup_mock).to receive(:write).twice
      expect(::Bootloader::BootRecordBackup).to(
        receive(:new).with("/dev/sdb")
        .and_return(backup_mock)
      )
      expect(::Bootloader::BootRecordBackup).to(
        receive(:new).with("/dev/sda1")
        .and_return(backup_mock)
      )

      subject.run(stage1(devices: ["/dev/sdb", "/dev/sda1"]))
    end

    context "activate and generic mbr is disabled" do
      before do
        allow(::Bootloader::BootRecordBackup)
          .to receive(:new).and_return(double(write: true))
      end

      it "do not write generic mbr anywhere" do
        expect(Yast::Execute).to_not receive(:locally)
        expect(Yast::Execute).to_not receive(:on_target)
        subject.run(stage1(generic_mbr: false, activate: false))
      end

      it "do not set boot and legacy boot flag anywhere" do
        expect(Yast::Execute).to_not receive(:locally)
        expect(Yast::Execute).to_not receive(:on_target)
        subject.run(stage1(generic_mbr: false, activate: false))
      end
    end

    context "when generic mbr is enabled" do
      before do
        allow(Yast::Stage).to receive(:initial).and_return(false)
        allow(Yast::Package).to receive(:Install)
        allow(::Bootloader::BootRecordBackup)
          .to receive(:new).and_return(double(write: true))
      end

      it "do nothing if mbr_disk is in Bootloader devices, so we install there bootloader stage1" do
        expect(Yast::Execute).to_not receive(:locally)
        expect(Yast::Execute).to_not receive(:on_target)
        subject.run(stage1(generic_mbr: true, devices: ["/dev/sda"]))
      end

      it "rewrites mbr_disk with generic code" do
        expect(Yast::Execute).to receive(:locally) do |*args|
          return nil unless args.first =~ /dd/

          expect(args).to be_include("of=/dev/sda")
        end
        subject.run(stage1(generic_mbr: true))
      end

      xit "always uses real devices" do
        allow(Yast::BootStorage).to receive(:mbr_disk)
          .and_return("/dev/md0")

        allow(::Bootloader::Stage1Device).to receive(:new).with("/dev/md0")
          .and_return(double(real_devices: ["/dev/sda1", "/dev/sdb1"]))
        expect(Yast::Execute).to receive(:locally).at_least(:twice) do |*args|
          next nil unless args.first =~ /dd/
          next nil unless args.include?("of=/dev/sdb")

          expect(args).to be_include("of=/dev/sda")
        end
        subject.run(stage1(generic_mbr: true))
      end

      it "install syslinux if not on initial stage" do
        allow(Yast::Stage).to receive(:initial).and_return(false)
        expect(Yast::Package).to receive(:Install).with("syslinux")

        subject.run(stage1(generic_mbr: true))
      end

      it "install gpt generic code if disk is gpt" do
        expect(Yast::Execute).to receive(:locally) do |*args|
          return nil unless args.first =~ /dd/

          expect(args.any? { |a| a =~ /if=.*gptmbr.bin/ }).to eq true
        end

        subject.run(stage1(generic_mbr: true))
      end
    end

    context "when activate is enabled" do
      before do
        allow(Yast::Stage).to receive(:initial).and_return(false)
        allow(Yast::Package).to receive(:Install)
        allow(Yast::Execute).to receive(:locally).and_return("")
        allow(::Bootloader::BootRecordBackup)
          .to receive(:new).and_return(double(write: true))
      end

      context "disk label is DOS mbr" do
        before do
          devicegraph_stub("two_disks_msdos.yaml")
        end

        it "sets boot flag on all stage1 partitions" do
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sda", "set", 1, "boot", "on")
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sdb", "set", 2, "boot", "on")

          subject.run(stage1(activate: true, devices: ["/dev/sda1", "/dev/sdb2"]))
        end

        it "sets boot flag on a suitable partition on all stage1 disks" do
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sda", "set", 1, "boot", "on")
          # here 2 is important as /dev/sdb1 is swap which is not activatable
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sdb", "set", 2, "boot", "on")

          subject.run(stage1(activate: true, devices: ["/dev/sda", "/dev/sdb"]))
        end

        it "resets all old boot flags on disk before set boot flag" do
          parted_output = "BYT;\n" \
                          "/dev/sda:500GB:scsi:512:4096:gpt:ATA WDC WD5000BPKT-7:;\n" \
                          "1:1049kB:165MB:164MB:fat16:primary:boot, legacy_boot;\n" \
                          "2:165MB:8760MB:8595MB:linux-swap(v1):primary:;\n" \
                          "3:8760MB:30.2GB:21.5GB:ext4:primary:boot;\n" \
                          "4:30.2GB:500GB:470GB:ext4:primary:legacy_boot;"

          allow(Yast::Execute).to receive(:locally)
            .with(/parted/, "-sm", "/dev/sda", "print", anything)
            .and_return(parted_output)

          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sda", "set", "1", "boot", "off")
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sda", "set", "3", "boot", "off")

          subject.run(stage1(activate: true, devices: ["/dev/sda1", "/dev/sdb1"]))
        end
      end

      context "disk label is GPT" do
        before do
          devicegraph_stub("two_disks.yaml")
        end

        it "sets legacy_boot flag on all partitions in Bootloader devices" do
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sda", "set", 1, "legacy_boot", "on")
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sdb", "set", 1, "legacy_boot", "on")

          subject.run(stage1(activate: true, devices: ["/dev/sda1", "/dev/sdb1"]))
        end

        it "resets all old boot flags on disk before set boot flag" do
          parted_output = "BYT;\n" \
                          "/dev/sda:500GB:scsi:512:4096:gpt:ATA WDC WD5000BPKT-7:;\n" \
                          "1:1049kB:165MB:164MB:fat16:primary:boot, legacy_boot;\n" \
                          "2:165MB:8760MB:8595MB:linux-swap(v1):primary:;\n" \
                          "3:8760MB:30.2GB:21.5GB:ext4:primary:legacy_boot;\n"

          allow(Yast::Execute).to receive(:locally)
            .with(/parted/, "-sm", "/dev/sda", "print", anything)
            .and_return(parted_output)

          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sda", "set", "1", "legacy_boot", "off")
          expect(Yast::Execute).to receive(:locally)
            .with(/parted/, "-s", "/dev/sda", "set", "3", "legacy_boot", "off")

          subject.run(stage1(activate: true, devices: ["/dev/sda1", "/dev/sdb1"]))
        end
      end

      it "do not set any flag on old DOS MBR for logical partitions" do
        devicegraph_stub("logical.yaml")
        allow(Yast::Execute).to receive(:locally) do |*args|
          expect(args).to_not include("6")
          # empty return for quering parted
          ""
        end

        subject.run(stage1(activate: true, devices: ["/dev/sda1", "/dev/sda6"]))
      end
    end
  end
end
