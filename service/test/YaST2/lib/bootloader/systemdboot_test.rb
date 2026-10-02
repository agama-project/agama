# frozen_string_literal: true

# Vendored from yast2-bootloader's test/systemdboot_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/bls"
require "bootloader/systemdboot"

describe Bootloader::SystemdBoot do
  include_context "yast2-bootloader test setup"

  subject do
    sub = described_class.new
    sub
  end

  let(:destdir) { File.expand_path("data/", __dir__) }
  let(:cmdline_content) { "splash=silent quiet security=apparmor mitigations=off" }

  before do
    allow(Yast::BootStorage).to receive(:available_swap_partitions).and_return([])
    allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
    allow(Yast::Package).to receive(:Available).and_return(true)
    allow(Bootloader::Bls).to receive(:menu_timeout)
      .and_return(subject.timeout)
    allow(Bootloader::Bls).to receive(:default_menu)
      .and_return("Snapper: *openSUSE Tumbleweed 20241107")
    allow(Bootloader::Bls).to receive(:write_menu_timeout)
      .with(subject.timeout)
    allow(Yast::Execute).to receive(:on_target!)
      .with("/usr/bin/bootctl", "--json=short", "list", stdout: :capture)
      .and_return("[{\"title\" : \"openSUSE Tumbleweed\", \"isDefault\" : true," \
                  " \"type\" : \"type1\", \"id\" : \"file1.conf\" }," \
                  "{\"title\" : \"Snapper: 20241107\", \"isDefault\" : false,"\
                  " \"type\" : \"type1\", \"id\" : \"file2.conf\"}]")
  end

  describe "#read" do
    before do
      expect(Bootloader::Systeminfo).to receive(:secure_boot_active?).and_return(true)
      expect(Bootloader::Systeminfo).to receive(:update_nvram_active?).and_return(true)
      allow(Yast::Installation).to receive(:destdir).and_return(destdir)
    end

    it "reads bootloader flags from sysconfig" do
      subject.read

      expect(subject.secure_boot).to eq true
    end

    it "reads update nvram configuration from sysconfig" do
      subject.read

      expect(subject.update_nvram).to eq true
    end

    it "reads entries from /etc/kernel/cmdline" do
      subject.read

      expect(subject.cpu_mitigations.to_human_string).to eq "Off"
      expect(subject.kernel_params.serialize).to eq cmdline_content
    end
  end

  describe "#write" do
    before do
      allow(subject).to receive(:secure_boot).and_return(false)
      allow(Yast::Stage).to receive(:initial).and_return(true)
      allow(Yast::Installation).to receive(:destdir).and_return(destdir)
      subject.kernel_params.replace(cmdline_content)
      subject.timeout = 10
    end

    it "installs the bootloader" do
      allow(Bootloader::Bls).to receive(:write_menu_timeout)
        .with(subject.timeout)
      allow(Bootloader::Bls).to receive(:create_menu_entries)
      # install bootloader
      expect(Bootloader::Bls).to receive(:install_bootloader)
      expect(Bootloader::Bls).to receive(:set_authentication)

      subject.write
    end

    it "setups protective mbr to real disks containing /boot/efi" do
      subject.pmbr_action = :add
      allow(Bootloader::Bls).to receive(:write_menu_timeout)
        .with(subject.timeout)
      allow(Bootloader::Bls).to receive(:create_menu_entries)
      allow(Bootloader::Bls).to receive(:install_bootloader)
      allow(Bootloader::Bls).to receive(:set_authentication)
      allow(Yast::BootStorage).to receive(:gpt_boot_disk?).and_return(true)

      expect(Yast::Execute).to receive(:locally)
        .with("/usr/sbin/parted", "-s", "/dev/sda", "disk_set", "pmbr_boot", "on")
      subject.write
    end

    it "writes kernel cmdline" do
      allow(Bootloader::Bls).to receive(:write_menu_timeout)
        .with(subject.timeout)
      allow(Bootloader::Bls).to receive(:create_menu_entries)
      allow(Bootloader::Bls).to receive(:install_bootloader)
      allow(Bootloader::Bls).to receive(:set_authentication)

      subject.write
      # Checking written kernel parameters
      subject.read
      expect(subject.cpu_mitigations.to_human_string).to eq "Off"
      expect(subject.kernel_params.serialize).to include cmdline_content
    end

    it "creates menu entries" do
      allow(Bootloader::Bls).to receive(:write_menu_timeout)
        .with(subject.timeout)
      allow(Bootloader::Bls).to receive(:install_bootloader)
      allow(Bootloader::Bls).to receive(:set_authentication)

      # create menu entries
      expect(Bootloader::Bls).to receive(:create_menu_entries)

      subject.write
    end

    it "saves menu timeout" do
      allow(Bootloader::Bls).to receive(:create_menu_entries)
      allow(Bootloader::Bls).to receive(:install_bootloader)
      allow(Bootloader::Bls).to receive(:set_authentication)

      # Saving menu timeout
      expect(Bootloader::Bls).to receive(:write_menu_timeout)
        .with(subject.timeout)

      subject.write
    end
  end

  describe "#packages" do
    it "adds to list shim and mokutil on x86_64 with secure boot" do
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      subject.secure_boot = true

      expect(subject.packages).to include("shim")
    end
  end

  describe "#summary" do
    it "returns line with boot loader type specified" do
      expect(subject.summary).to include("Boot Loader Type: Systemd Boot")
    end

    it "returns line with secure boot option specified" do
      subject.secure_boot = false

      expect(subject.summary).to include(match(/Secure Boot: disabled/))
    end
  end

  describe "#merge" do
    it "overwrite secure boot, mitigations and menu timeout if specified in merged one" do
      other_cmdline = "splash=silent quiet mitigations=auto"
      other = described_class.new
      other.secure_boot = true
      other.timeout = 12
      other.kernel_params.replace(other_cmdline)
      other.update_nvram = true

      subject.secure_boot = false
      subject.timeout = 10
      subject.kernel_params.replace(cmdline_content)
      subject.update_nvram = false
      subject.merge(other)

      expect(subject.secure_boot).to eq true
      expect(subject.timeout).to eq 12
      expect(subject.update_nvram).to eq true
      expect(subject.cpu_mitigations.to_human_string).to eq "Auto"
      expect(subject.kernel_params.serialize)
        .to include "security=apparmor splash=silent quiet mitigations=auto"
    end
  end

  describe "#propose" do
    it "proposes timeout to product/role default" do
      allow(Yast::ProductFeatures).to receive(:GetIntegerFeature)
        .with("globals", "boot_timeout").and_return(2)
      subject.propose

      expect(subject.timeout).to eq 2
    end

    it "proposes secure boot" do
      allow(Bootloader::Systeminfo).to receive(:secure_boot_supported?).and_return(true)
      subject.propose

      expect(subject.secure_boot).to eq true
    end

    it "proposes to update nvram" do
      subject.propose

      expect(subject.update_nvram).to eq true
    end

    it "proposes kernel cmdline" do
      expect(Yast::BootArch).to receive(:DefaultKernelParams).and_return(cmdline_content)

      subject.propose
      expect(subject.kernel_params.serialize).to eq cmdline_content
    end
  end
end
