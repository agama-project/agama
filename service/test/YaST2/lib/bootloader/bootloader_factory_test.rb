# frozen_string_literal: true

# Vendored from yast2-bootloader's test/bootloader_factory_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/bootloader_factory"

describe Bootloader::BootloaderFactory do
  include_context "yast2-bootloader test setup"

  describe "#system" do
    it "returns BootloaderBase instance according to name in system sysconfig" do
      allow(Bootloader::Sysconfig).to receive(:from_system)
        .and_return(Bootloader::Sysconfig.new(bootloader: "grub2"))

      expect(Bootloader::BootloaderFactory.system).to be_a(Bootloader::BootloaderBase)
    end

    it "raises exception if specified bootloader is not supported" do
      allow(Bootloader::Sysconfig).to receive(:from_system)
        .and_return(Bootloader::Sysconfig.new(bootloader: "grub"))

      expect do
        Bootloader::BootloaderFactory.system
      end.to raise_error(Bootloader::UnsupportedBootloader)
    end

    it "returns nil if sysconfig do not specify bootloader" do
      allow(Bootloader::Sysconfig).to receive(:from_system)
        .and_return(Bootloader::Sysconfig.new)

      expect(Bootloader::BootloaderFactory.system).to eq nil
    end
  end
  describe "#supported_names" do
    context "on x86_64 architectures" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("x86_64")
      end

      context "product supports systemd-boot" do
        before do
          allow(Yast::ProductFeatures).to receive(:GetBooleanFeature).with("globals",
            "enable_systemd_boot").and_return(true)
        end
        it "returns systemd-boot in the list" do
          expect(Bootloader::BootloaderFactory.supported_names).to contain_exactly("grub2",
            "grub2-efi", "grub2-bls", "systemd-boot", "none")
        end
      end
      context "product does not support systemd-boot" do
        before do
          allow(Yast::ProductFeatures).to receive(:GetBooleanFeature).with("globals",
            "enable_systemd_boot").and_return(false)
        end
        it "does not include systemd-boot in the list" do
          expect(Bootloader::BootloaderFactory.supported_names).to contain_exactly("grub2",
            "grub2-efi", "grub2-bls", "none")
        end
      end
    end

    context "on aarch64 architectures" do
      before do
        allow(Yast::Arch).to receive(:architecture).and_return("aarch64")
      end

      context "product supports systemd-boot" do
        before do
          allow(Yast::ProductFeatures).to receive(:GetBooleanFeature).with("globals",
            "enable_systemd_boot").and_return(true)
        end
        it "does not include grub2 in the list" do
          expect(Bootloader::BootloaderFactory.supported_names).to eq ["grub2-efi", "grub2-bls",
                                                                       "systemd-boot", "none"]
        end
      end
      context "product does not support systemd-boot" do
        before do
          allow(Yast::ProductFeatures).to receive(:GetBooleanFeature).with("globals",
            "enable_systemd_boot").and_return(false)
        end
        it "does not include systemd-boot and grub2 in the list" do
          expect(Bootloader::BootloaderFactory.supported_names).to eq ["grub2-efi", "grub2-bls",
                                                                       "none"]
        end
      end
    end
  end
end
