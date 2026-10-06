# frozen_string_literal: true

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/kexec"

describe Bootloader::Kexec do
  include_context "yast2-bootloader test setup"

  describe ".prepare_environment" do
    before do
      allow(Yast::WFM).to receive(:Execute).and_return("exit" => 0)

      Yast.import "ProductFeatures"
      allow(Yast::ProductFeatures).to receive(:GetBooleanFeature)
        .with("globals", "kexec_reboot").and_return(true)
      Yast.import "Arch"
      allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      Yast.import "Mode"
      allow(Yast::Mode).to receive(:live_installation).and_return(false)
      allow(Yast::SCR).to receive(:Read)
        .with(Yast::Path.new(".probe.bios"))
        .and_return([])
    end

    it "returns false if running in live installation" do
      Yast.import "Mode"
      allow(Yast::Mode).to receive(:live_installation).and_return(true)

      expect(subject.prepare_environment).to be false
    end

    it "returns false if Product do not allow kexec" do
      allow(Yast::ProductFeatures).to receive(:GetBooleanFeature)
        .with("globals", "kexec_reboot").and_return(false)

      expect(subject.prepare_environment).to be false
    end

    it "returns false if running on s390" do
      allow(Yast::Arch).to receive(:architecture).and_return("s390_64")

      expect(subject.prepare_environment).to be false
    end

    it "returns false if running on ppc" do
      allow(Yast::Arch).to receive(:architecture).and_return("ppc64")

      expect(subject.prepare_environment).to be false
    end

    it "returns false if running in VirtualBox" do
      bios_data = [
        "smbios" => [
          "type"    => "sysinfo",
          "product" => "VirtualBox"
        ]
      ]
      allow(Yast::SCR).to receive(:Read)
        .with(Yast::Path.new(".probe.bios"))
        .and_return(bios_data)

      expect(subject.prepare_environment).to be false
    end

    it "returns false if running in Hyper VM" do
      bios_data = [
        "smbios" => [
          "type"         => "sysinfo",
          "product"      => "Virtual Machine",
          "manufacturer" => "Microsoft Corporation"
        ]
      ]
      allow(Yast::SCR).to receive(:Read)
        .with(Yast::Path.new(".probe.bios"))
        .and_return(bios_data)

      expect(subject.prepare_environment).to be false
    end

    it "returns false if initrd and vmlinuz copy failed" do
      allow(Yast::WFM).to receive(:Execute).with(anything, /\/bin\/cp/)
        .and_return("exit" => 1)

      expect(subject.prepare_environment).to be false
    end

    it "returns true when copy initrd and vmlinuz to destination" do
      expect(Yast::WFM).to receive(:Execute).with(anything, /\/bin\/cp/)
        .and_return("exit" => 0)

      expect(subject.prepare_environment).to be true
    end
  end
end
