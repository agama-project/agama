# frozen_string_literal: true

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
    # Do not read the host's /etc/sysconfig/bootloader: the system bootloader is
    # prepended to the list, which would make the result depend on the machine.
    before do
      allow(Bootloader::Sysconfig).to receive(:from_system)
        .and_return(Bootloader::Sysconfig.new)
    end

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

  describe ".bls_installable?" do
    let(:efi) { true }
    let(:x86_64) { true }

    before do
      allow(Bootloader::Systeminfo).to receive(:efi?).and_return(efi)
      allow(Yast::Arch).to receive(:x86_64).and_return(x86_64)
      allow(Yast::Arch).to receive(:i386).and_return(false)
      allow(Yast::Arch).to receive(:aarch64).and_return(false)
      allow(Yast::Arch).to receive(:arm).and_return(false)
      allow(Yast::Arch).to receive(:riscv64).and_return(false)
    end

    context "on a supported architecture with EFI" do
      it "returns true" do
        expect(described_class.bls_installable?).to eq true
      end
    end

    context "on a supported architecture without EFI" do
      let(:efi) { false }

      it "returns false" do
        expect(described_class.bls_installable?).to eq false
      end
    end

    context "on an unsupported architecture" do
      let(:x86_64) { false }

      it "returns false" do
        expect(described_class.bls_installable?).to eq false
      end
    end
  end
end
