# frozen_string_literal: true

# Vendored from yast2-bootloader's test/grub2_efi_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/grub2efi"

describe Bootloader::Grub2EFI do
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
    allow(Bootloader::GrubInstall).to receive(:new).and_return(double.as_null_object)
    allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
    allow(Yast::Package).to receive(:Available).and_return(true)
  end

  describe "#read" do
    it "reads bootloader flags from sysconfig" do
      sysconfig = double(Bootloader::Sysconfig, secure_boot: true, update_nvram: true)
      expect(Bootloader::Sysconfig).to receive(:from_system).and_return(sysconfig).at_least(:once)

      subject.read

      expect(subject.secure_boot).to eq true
      expect(subject.update_nvram).to eq true
    end
  end

  describe "#write" do
    it "setups protective mbr to real disks containing /boot/efi" do
      subject.pmbr_action = :add
      allow(Yast::BootStorage).to receive(:gpt_boot_disk?).and_return(true)
      expect(Yast::Execute).to receive(:locally)
        .with("/usr/sbin/parted", "-s", "/dev/sda", "disk_set", "pmbr_boot", "on")

      subject.write
    end

    it "calls grub2-install with respective boot flags configuration on " \
       "non-transactional systems" do
      # This test fails (only!) in Travis with
      # Failure/Error: subject.write Storage::Exception: Storage::Exception
      grub_install = double(Bootloader::GrubInstall)
      expect(grub_install).to receive(:execute).with(secure_boot: true, update_nvram: false)
      allow(Bootloader::GrubInstall).to receive(:new).and_return(grub_install)

      subject.secure_boot = true
      subject.update_nvram = false

      subject.write

      expect(grub_install).to_not receive(:execute)

      subject.write(etc_only: true)
    end

  end

  describe "#prepare" do
    let(:sysconfig) { double(Bootloader::Sysconfig) }

    before do
      allow(Bootloader::Sysconfig).to receive(:from_system)
      allow(Yast::Package).to receive(:InstallAll).and_return(true)
    end

    it "writes boot flags configuration to bootloader sysconfig" do
      # This test fails (only!) in Travis with
      # Failure/Error: subject.write Storage::Exception: Storage::Exception
      expect(Bootloader::Sysconfig).to receive(:new)
        .with(bootloader: "grub2-efi", secure_boot: true, update_nvram: true)
        .and_return(sysconfig)
      expect(sysconfig).to receive(:write)

      subject.secure_boot = true
      subject.update_nvram = true

      subject.prepare
    end
  end

  context "#propose" do
    it "proposes to remove pmbr flag for disk" do
      subject.propose

      expect(subject.pmbr_action).to eq :remove
    end

    it "proposes to update nvram" do
      subject.propose

      expect(subject.update_nvram).to eq true
    end

    it "proposes to use secure boot for x86_64" do
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      subject.propose

      expect(subject.secure_boot).to eq true
    end

    it "proposes to use secure boot for aarch64" do
      allow(Yast::Arch).to receive(:architecture).and_return("aarch64")
      subject.propose

      expect(subject.secure_boot).to eq true
    end

    it "proposes to not use secure boot for riscv64" do
      allow(Yast::Arch).to receive(:architecture).and_return("riscv64")
      subject.propose

      expect(subject.secure_boot).to eq false
    end

    it "proposes to not use secure boot for arm" do
      allow(Yast::Arch).to receive(:architecture).and_return("arm")
      subject.propose

      expect(subject.secure_boot).to eq false
    end
  end

  describe "#packages" do
    it "adds to list grub2-i386-efi on i386 architecture" do
      allow(Yast::Arch).to receive(:architecture).and_return("i386")

      expect(subject.packages).to include("grub2-i386-efi")
    end

    it "adds to list grub2-arm-efi on arm" do
      allow(Yast::Arch).to receive(:architecture).and_return("arm")

      expect(subject.packages).to include("grub2-arm-efi")
    end

    it "adds to list grub2-arm64-efi on aarch64" do
      allow(Yast::Arch).to receive(:architecture).and_return("aarch64")

      expect(subject.packages).to include("grub2-arm64-efi")
    end

    it "adds to list grub2-x86_64-efi on x86_64" do
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")

      expect(subject.packages).to include("grub2-x86_64-efi")
    end

    it "adds to list grub2-riscv64-efi on riscv64" do
      allow(Yast::Arch).to receive(:architecture).and_return("riscv64")

      expect(subject.packages).to include("grub2-riscv64-efi")
    end

    it "adds to list shim and mokutil on x86_64 with secure boot" do
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      subject.secure_boot = true

      expect(subject.packages).to include("shim")
      expect(subject.packages).to include("mokutil")
    end
  end

  describe "#summary" do
    it "returns line with boot loader type specified" do
      expect(subject.summary).to include("Boot Loader Type: GRUB2 EFI")
    end

    it "returns line with secure boot option specified" do
      subject.secure_boot = false

      expect(subject.summary).to include(match(/Secure Boot: disabled/))
    end
  end

  describe "#merge" do
    it "overwrite secure boot if specified in merged one" do
      other = described_class.new
      other.secure_boot = true

      subject.secure_boot = false

      subject.merge(other)

      expect(subject.secure_boot).to eq true
    end
  end
end
