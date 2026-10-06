# frozen_string_literal: true

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/grub2"

describe Bootloader::Grub2 do
  include_context "yast2-bootloader test setup"

  subject do
    sub = described_class.new
    allow(sub).to receive(:cpu_mitigations).and_return(::Bootloader::CpuMitigations.new(:manual))
    sub
  end

  before do
    allow(::CFA::Grub2::Default).to receive(:new).and_return(double("GrubDefault").as_null_object)
    allow(::CFA::Grub2::GrubCfg).to receive(:new).and_return(double("GrubCfg").as_null_object)
    allow(Bootloader::Sections).to receive(:new).and_return(double("Sections").as_null_object)
    allow(Yast::BootStorage).to receive(:available_swap_partitions).and_return([])
    allow(Yast::BootStorage).to receive(:gpt_boot_disk?).and_return(false)
  end

  describe "#read" do
    before do
      allow(Bootloader::Stage1).to receive(:new).and_return(double.as_null_object)
      allow(Bootloader::DeviceMap).to receive(:new).and_return(double.as_null_object)
    end

    it "reads device map on legacy intel" do
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")

      device_map = double(Bootloader::DeviceMap)
      expect(device_map).to receive(:read)
      allow(Bootloader::DeviceMap).to receive(:new).and_return(device_map)

      subject.read
    end

    it "reads bootloader stage1 location" do
      stage1 = double(Bootloader::Stage1)
      expect(stage1).to receive(:read)
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)

      subject.read
    end
  end

  describe "write" do
    let(:stage1) { double(Bootloader::Stage1, devices: [], generic_mbr?: false, write: nil) }

    before do
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)
      allow(Bootloader::MBRUpdate).to receive(:new).and_return(double(run: nil))
      allow(Bootloader::GrubInstall).to receive(:new).and_return(double.as_null_object)
      allow(Bootloader::DeviceMap).to receive(:new).and_return(double.as_null_object)
      allow(Yast::BootStorage).to receive(:gpt_disks).and_return(["/dev/sdb"])
    end

    it "writes stage1 location" do
      stage1 = double(Bootloader::Stage1, devices: [], generic_mbr?: false)
      expect(stage1).to receive(:write)
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)

      subject.write
    end

    it "changes pmbr flag as specified in pmbr_action for all boot devices with gpt label" do
      stage1 = double(Bootloader::Stage1, devices: ["/dev/sda", "/dev/sdb1"], generic_mbr?: false,
write: nil)
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)

      allow(Yast::BootStorage).to receive(:gpt_boot_disk?).and_return(true)
      devicegraph_stub("msdos_and_gpt.yaml")

      expect(Yast::Execute).to receive(:locally)
        .with("/usr/sbin/parted", "-s", "/dev/sdb", "disk_set", "pmbr_boot", "on")
      subject.pmbr_action = :add

      subject.write
    end

    it "runs grub2-install for all configured stage1 locations on non-transactional systems" do
      stage1 = double(Bootloader::Stage1, devices: ["/dev/sda", "/dev/sdb1"], generic_mbr?: false,
write: nil)
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)

      grub2_install = double(Bootloader::GrubInstall)
      expect(grub2_install).to receive(:execute)
        .with(devices: ["/dev/sda",
                        "/dev/sdb1"], secure_boot: nil, update_nvram: true).and_return([])
      expect(Bootloader::GrubInstall).to receive(:new).with(efi: false).and_return(grub2_install)

      subject.write

      expect(grub2_install).to_not receive(:execute)

      subject.write(etc_only: true)
    end

    context "on s390" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
      end

      it "does not run mbr update for configured stage1 flags" do
        expect(Bootloader::MBRUpdate).to_not receive(:new)

        subject.write
      end
    end

    context "on other architectures" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      end

      it "runs mbr update for configured stage1 flags on non-transactional systems" do
        mbr_update = double(Bootloader::MBRUpdate)
        expect(mbr_update).to receive(:run)
        expect(Bootloader::MBRUpdate).to receive(:new).and_return(mbr_update)

        subject.write

        expect(mbr_update).to_not receive(:run)

        subject.write(etc_only: true)
      end
    end
  end

  context "#propose" do
    before do
      stage1 = double.as_null_object
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)
      allow(Bootloader::DeviceMap).to receive(:new).and_return(double.as_null_object)
    end

    it "proposes stage1" do
      stage1 = double
      expect(stage1).to receive(:propose)
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)

      subject.propose
    end

    it "propose to add pmbr flag" do
      subject.propose

      expect(subject.pmbr_action).to eq :add
    end
  end

  describe "#name" do
    it "returns \"grub2\"" do
      expect(subject.name).to eq "grub2"
    end
  end

  describe "#packages" do
    let(:initial_stage) { true }
    let(:generic_mbr) { true }
    let(:stage1) { double(generic_mbr?: generic_mbr) }

    before do
      allow(Yast::Stage).to receive(:initial).and_return(initial_stage)
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)
      allow(Yast::Package).to receive(:Available).and_return(true)
    end

    it "contains grub2 package" do
      expect(subject.packages).to include("grub2")
    end

    context "when is in initial stage" do
      it "does not include syslinux" do
        expect(subject.packages).to_not include("syslinux")
      end
    end

    context "when is not in initial stage" do
      let(:initial_stage) { false }

      context "and generic_mbr is used" do
        it "contains syslinux package" do
          expect(subject.packages).to include("syslinux")
        end
      end

      context "and generic_mbr is not used" do
        let(:generic_mbr) { false }

        it "contains syslinux package" do
          expect(subject.packages).to_not include("syslinux")
        end
      end
    end

    context "on non-s390 architectures" do
      before do
        allow(Yast::Arch).to receive(:s390).and_return(false)
      end

      context "if the os-prober package is available" do
        it "contains the os-prober package" do
          expect(subject.packages).to include("os-prober")
        end
      end

      context "if the os-prober package is not available" do
        it "does not contain the os-prober package" do
          expect(subject.packages).to include("os-prober")
        end
      end
    end

    context "on the s390 architecture" do
      before do
        allow(Yast::Arch).to receive(:s390_64).and_return(true)
      end

      it "does not contain the os-prober package" do
        expect(subject.packages).to_not include("os-prober")
      end
    end
  end

  describe "#summary" do
    before do
      stage1 = double(can_use_boot?: true, extended_partition?: false).as_null_object
      allow(Bootloader::Stage1).to receive(:new).and_return(stage1)

    end

    it "contains line saying that bootloader type is GRUB2" do
      expect(subject.summary).to include("Boot Loader Type: GRUB2")
    end

    context "when arch is not s390" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      end

      it "includes order of hard disks if there are more than 1" do
        allow(subject.device_map).to receive(:size).and_return(2)
        allow(subject.device_map).to receive(:disks_order).and_return(["/dev/sda", "/dev/sdb"])

        expect(subject.summary).to include(%r{Order of Hard Disks: /dev/sda, /dev/sdb})
      end

      it "does not include order of hard disk if there is only 1" do
        allow(subject.device_map).to receive(:size).and_return(1)

        expect(subject.summary).to_not include(/Order of Hard Disks/)
      end
    end

    context "when arch is s390" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("s390_64")
      end

      it "does not includes order of hard disks" do
        expect(subject.summary).to_not include(/Order of Hard Disks/)
      end
    end
  end

  describe "#merge" do
    let(:other) { described_class.new }
    it "replaces device map if merged one is not empty" do
      other.device_map.add_mapping("hd0", "/dev/sda")

      subject.merge(other)

      expect(subject.device_map.system_device_for("hd0")).to eq "/dev/sda"
    end

    context "stage1 does not contain any device" do
      before do
        allow(Bootloader::Stage1).to receive(:new).and_call_original
        allow(other.stage1).to receive(:devices).and_return([])
      end

      it "sets activate flag if subject or merged one contain it" do
        subject.stage1.activate = true
        other.stage1.activate = false

        subject.merge(other)

        expect(subject.stage1.activate?).to eq true

        subject.stage1.activate = false
        other.stage1.activate = false

        subject.merge(other)

        expect(subject.stage1.activate?).to eq false

        subject.stage1.activate = false
        other.stage1.activate = true

        subject.merge(other)

        expect(subject.stage1.activate?).to eq true
      end

      it "sets generic_mbr flag if subject or merged one contain it" do
        subject.stage1.generic_mbr = true
        other.stage1.generic_mbr = false

        subject.merge(other)

        expect(subject.stage1.generic_mbr?).to eq true

        subject.stage1.generic_mbr = false
        other.stage1.generic_mbr = false

        subject.merge(other)

        expect(subject.stage1.generic_mbr?).to eq false

        subject.stage1.generic_mbr = false
        other.stage1.generic_mbr = true

        subject.merge(other)

        expect(subject.stage1.generic_mbr?).to eq true
      end
    end

    context "stage1 contains devices" do
      before do
        allow(Bootloader::Stage1).to receive(:new).and_call_original
        allow(other.stage1).to receive(:devices).and_return(["/dev/sda"])
      end

      it "replaces activate flag with merged one" do
        subject.stage1.activate = true
        other.stage1.activate = false

        subject.merge(other)

        expect(subject.stage1.activate?).to eq false

        subject.stage1.activate = false
        other.stage1.activate = false

        subject.merge(other)

        expect(subject.stage1.activate?).to eq false

        subject.stage1.activate = false
        other.stage1.activate = true

        subject.merge(other)

        expect(subject.stage1.activate?).to eq true
      end

      it "replaces generic_mbr flag with merged one" do
        subject.stage1.generic_mbr = true
        other.stage1.generic_mbr = false

        subject.merge(other)

        expect(subject.stage1.generic_mbr?).to eq false

        subject.stage1.generic_mbr = false
        other.stage1.generic_mbr = false

        subject.merge(other)

        expect(subject.stage1.generic_mbr?).to eq false

        subject.stage1.generic_mbr = false
        other.stage1.generic_mbr = true

        subject.merge(other)

        expect(subject.stage1.generic_mbr?).to eq true
      end

      it "replaces all stage1 devices with merged ones" do
        subject.stage1.clear_devices
        subject.stage1.add_udev_device("/dev/sda2")

        subject.merge(other)

        expect(subject.stage1.devices).to eq ["/dev/sda"]
      end
    end
  end
end
