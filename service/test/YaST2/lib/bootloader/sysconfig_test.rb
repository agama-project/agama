# frozen_string_literal: true

# Vendored from yast2-bootloader's test/sysconfig_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/sysconfig"

describe Bootloader::Sysconfig do
  include_context "yast2-bootloader test setup"

  before do
    allow(Yast::SCR).to receive(:Write)
    allow(Yast::SCR).to receive(:Read)
  end

  describe ".from_system" do
    it "reads value from file on system" do
      expect(Yast::SCR).to receive(:Read).with(
        Yast::Path.new(".sysconfig.bootloader.LOADER_TYPE")
      ).and_return("grub2")
      expect(Yast::SCR).to receive(:Read).with(
        Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
      ).and_return("no")
      expect(Yast::SCR).to receive(:Read).with(
        Yast::Path.new(".sysconfig.bootloader.UPDATE_NVRAM")
      ).and_return("yes")

      sysconfig = Bootloader::Sysconfig.from_system
      expect(sysconfig.bootloader).to eq "grub2"
      expect(sysconfig.secure_boot).to be false
      expect(sysconfig.update_nvram).to be true
    end

    it "defaults update_nvram to true if not set" do
      allow(Yast::SCR).to receive(:Read).with(
        Yast::Path.new(".sysconfig.bootloader.UPDATE_NVRAM")
      ).and_return(nil)

      sysconfig = Bootloader::Sysconfig.from_system
      expect(sysconfig.update_nvram).to be true
    end

    context "x86_64" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      end

      it "defaults secure_boot to true if not set" do
        allow(Yast::SCR).to receive(:Read).with(
          Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
        ).and_return(nil)

        sysconfig = Bootloader::Sysconfig.from_system
        expect(sysconfig.secure_boot).to be true
      end
    end

    context "aarch64" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("aarch64")
      end

      it "defaults secure_boot to true if not set" do
        allow(Yast::SCR).to receive(:Read).with(
          Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
        ).and_return(nil)

        sysconfig = Bootloader::Sysconfig.from_system
        expect(sysconfig.secure_boot).to be true
      end
    end
  end

  describe "#write" do
    it "writes attributes to sysconfig file" do
      sysconfig = Bootloader::Sysconfig.new(bootloader: "grub2", secure_boot: true)
      expect(Yast::SCR).to receive(:Write).with(
        Yast::Path.new(".sysconfig.bootloader.LOADER_TYPE"), "grub2"
      )
      expect(Yast::SCR).to receive(:Write).with(
        Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT"), "yes"
      )

      sysconfig.write
    end

    it "write comments for attributes if it is not already written" do
      sysconfig = Bootloader::Sysconfig.new(bootloader: "grub2", secure_boot: true)
      allow(Yast::SCR).to receive(:Read).with(
        Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT.comment")
      )
        .and_return("comment ABC")
      expect(Yast::SCR).to receive(:Write).with(
        Yast::Path.new(".sysconfig.bootloader.LOADER_TYPE.comment"), anything
      )
      expect(Yast::SCR).to receive(:Write).with(
        Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT.comment"), anything
      ).never

      sysconfig.write
    end
  end

  describe "#pre_write" do
    before do
      allow(Yast::WFM).to receive(:Execute)
      Yast.import "Installation"
      allow(Yast::Installation).to receive(:destdir).and_return("/mnt")
    end

    it "writes attributes to sysconfig file on target system even if SCR is not switched" do
      sysconfig = Bootloader::Sysconfig.new(bootloader: "grub2", secure_boot: true)
      expect(Yast::SCR).to receive(:Write).with(
        Yast::Path.new(".target.sysconfig.bootloader.LOADER_TYPE"), "grub2"
      )
      expect(Yast::SCR).to receive(:Write).with(
        Yast::Path.new(".target.sysconfig.bootloader.SECURE_BOOT"), "yes"
      )

      sysconfig.pre_write
    end

    it "ensures that sysconfig exists on target system" do
      sysconfig = Bootloader::Sysconfig.new(bootloader: "grub2", secure_boot: true)
      expect(Yast::WFM).to receive(:Execute).with(
        Yast::Path.new(".local.mkdir"), "/mnt/etc/sysconfig"
      )
      expect(Yast::WFM).to receive(:Execute).with(
        Yast::Path.new(".local.bash"), "touch /mnt/etc/sysconfig/bootloader"
      )

      sysconfig.pre_write
    end
  end
end
