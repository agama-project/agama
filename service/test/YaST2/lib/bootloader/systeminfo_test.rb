# frozen_string_literal: true

# Vendored from yast2-bootloader's test/systeminfo_test.rb.
# This is a permanent fork (see service/YaST2/README.md): the `yast2-bootloader` RPM
# is no longer a runtime dependency of Agama.

require_relative "../../../test_helper"
require_relative "support/shared_setup"

require "bootloader/systeminfo"

describe Bootloader::Systeminfo do
  include_context "yast2-bootloader test setup"

  let(:arch) { nil }

  before do
    allow(Yast::Arch).to receive(:architecture).and_return(arch)
    allow(Yast::SCR).to receive(:Write)
    allow(Yast::SCR).to receive(:Read)
  end

  describe ".secure_boot_active?" do
    context "if arch is x86_64" do
      let(:arch) { "x86_64" }

      context "if SECURE_BOOT is 'yes' in sysconfig" do
        it "returns true" do
          allow(Yast::SCR).to receive(:Read).with(
            Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
          ).and_return("yes")
          expect(described_class.secure_boot_active?).to be true
        end
      end

      context "if SECURE_BOOT is 'no' in sysconfig" do
        it "returns false" do
          allow(Yast::SCR).to receive(:Read).with(
            Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
          ).and_return("no")
          expect(described_class.secure_boot_active?).to be false
        end
      end
    end

    context "if arch is s390x" do
      let(:arch) { "s390_64" }

      context "if SECURE_BOOT is 'yes' in sysconfig" do
        it "returns true" do
          allow(Yast::SCR).to receive(:Read).with(
            Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
          ).and_return("yes")
          expect(described_class.secure_boot_active?).to be false
        end
      end

      context "if SECURE_BOOT is 'no' in sysconfig" do
        it "returns false" do
          allow(Yast::SCR).to receive(:Read).with(
            Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
          ).and_return("no")
          expect(described_class.secure_boot_active?).to be false
        end
      end
    end

    context "if arch is ppc64" do
      let(:arch) { "ppc64" }

      context "if SECURE_BOOT is 'yes' in sysconfig" do
        it "returns true" do
          allow(Yast::SCR).to receive(:Read).with(
            Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
          ).and_return("yes")
          expect(described_class.secure_boot_active?).to be false
        end
      end

      context "if SECURE_BOOT is 'no' in sysconfig" do
        it "returns false" do
          allow(Yast::SCR).to receive(:Read).with(
            Yast::Path.new(".sysconfig.bootloader.SECURE_BOOT")
          ).and_return("no")
          expect(described_class.secure_boot_active?).to be false
        end
      end
    end
  end

  describe ".secure_boot_available?" do
    context "if bootloader is grub2" do
      context "and arch is x86_64" do
        let(:arch) { "x86_64" }
        it "returns false" do
          expect(described_class.secure_boot_available?("grub2")).to be false
        end
      end

      context "and has_secure is 1 on arch s390x " do
        let(:arch) { "s390_64" }
        it "returns true" do
          allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return("1")
          allow(File).to receive(:read).with("/proc/device-tree/ibm,secure-boot").and_return(nil)
          expect(described_class.secure_boot_available?("grub2")).to be true
        end
      end

      context "and ibm,secure-boot is not available on arch ppc64le " do
        let(:arch) { "ppc64" }
        it "returns false and secure_boot_active? returns false" do
          allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return(false)
          allow(File).to receive(:read).with("/proc/device-tree/ibm,secure-boot").and_return(nil)
          expect(described_class.secure_boot_available?("grub2")).to be false
          expect(described_class.secure_boot_active?).to be false
        end
      end

      context "and ibm,secure-boot is not enabled on arch ppc64le " do
        let(:arch) { "ppc64" }
        it "returns true and secure_boot_active? returns true" do
          allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return(false)
          allow(File).to receive(:read).with("/proc/device-tree/ibm,secure-boot")
            .and_return("\0\0\0\0")
          expect(described_class.secure_boot_available?("grub2")).to be true
          expect(described_class.secure_boot_active?).to be true
        end
      end

      context "and ibm,secure-boot is enforcing on arch ppc64le " do
        let(:arch) { "ppc64" }
        it "returns true and secure_boot_active? returns true" do
          allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return(false)
          allow(File).to receive(:read).with("/proc/device-tree/ibm,secure-boot")
            .and_return("\0\0\0\2")
          expect(described_class.secure_boot_available?("grub2")).to be true
          expect(described_class.secure_boot_active?).to be true
        end
      end
    end

    context "if bootloader is grub2-efi" do
      context "and arch is x86_64" do
        let(:arch) { "x86_64" }

        it "returns true" do
          expect(described_class.secure_boot_available?("grub2-efi")).to be true
        end
      end

      context "and arch is aarch64" do
        let(:arch) { "aarch64" }

        it "returns true" do
          expect(described_class.secure_boot_available?("grub2-efi")).to be true
        end
      end

      context "and arch is arm" do
        let(:arch) { "arm" }

        it "returns false" do
          expect(described_class.secure_boot_available?("grub2-efi")).to be false
        end
      end

      context "and arch is riscv64" do
        let(:arch) { "riscv64" }

        it "returns false" do
          expect(described_class.secure_boot_available?("grub2-efi")).to be false
        end
      end
    end
  end

  describe ".efi_used?" do
    context "if bootloader is grub2-efi" do
      it "returns true" do
        expect(described_class.efi_used?("grub2-efi")).to be true
      end
    end

    context "if bootloader is grub2" do
      it "returns false" do
        expect(described_class.efi_used?("grub2")).to be false
      end
    end
  end

  describe ".efi_supported?" do
    context "if arch is x86_64" do
      let(:arch) { "x86_64" }

      it "returns true" do
        expect(described_class.efi_supported?).to be true
      end
    end

    context "if arch is i386" do
      let(:arch) { "i386" }

      it "returns true" do
        expect(described_class.efi_supported?).to be true
      end
    end

    context "if arch is aarch64" do
      let(:arch) { "aarch64" }

      it "returns true" do
        expect(described_class.efi_supported?).to be true
      end
    end

    context "if arch is ppc64" do
      let(:arch) { "ppc64" }

      it "returns false" do
        expect(described_class.efi_supported?).to be false
      end
    end

    context "if arch is s390x" do
      let(:arch) { "s390_64" }

      it "returns false" do
        expect(described_class.efi_supported?).to be false
      end
    end
  end

  describe ".shim_needed?" do
    context "if UEFI is used and arch is x86_64" do
      let(:arch) { "x86_64" }

      context "and secure boot is enabled" do
        it "returns true" do
          expect(described_class.shim_needed?("grub2-efi", true)).to be true
        end
      end

      context "and secure boot is disabled" do
        it "returns false" do
          expect(described_class.shim_needed?("grub2-efi", false)).to be false
        end
      end
    end

    context "if UEFI is used and arch is aarch64" do
      let(:arch) { "aarch64" }

      context "and secure boot is enabled" do
        it "returns true" do
          expect(described_class.shim_needed?("grub2-efi", true)).to be true
        end
      end

      context "and secure boot is disabled" do
        it "returns false" do
          expect(described_class.shim_needed?("grub2-efi", false)).to be false
        end
      end
    end

    context "if UEFI is not used and arch is x86_64" do
      let(:arch) { "x86_64" }

      context "and secure boot is disabled" do
        it "returns true" do
          expect(described_class.shim_needed?("grub2", false)).to be false
        end
      end
    end

    context "if UEFI is not used and arch is s390x" do
      let(:arch) { "s390_64" }

      context "and secure boot is enabled" do
        it "returns false" do
          expect(described_class.shim_needed?("grub2", true)).to be false
        end
      end

      context "and secure boot is disabled" do
        it "returns false" do
          expect(described_class.shim_needed?("grub2", false)).to be false
        end
      end
    end
  end

  describe ".s390_secure_boot_available?" do
    context "if arch is s390x" do
      let(:arch) { "s390_64" }

      context "and has_secure is 1" do
        it "returns true" do
          allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return("1")
          expect(described_class.s390_secure_boot_available?).to be true
        end
      end

      context "and has_secure is 0" do
        it "returns false" do
          allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return("0")
          expect(described_class.s390_secure_boot_available?).to be false
        end
      end
    end

    context "if arch is x86_64" do
      let(:arch) { "x86_64" }

      it "returns false" do
        expect(described_class.s390_secure_boot_available?).to be false
      end
    end
  end

  describe ".s390_secure_boot_supported?" do
    context "if arch is s390x" do
      let(:arch) { "s390_64" }

      context "and zipl is on DASD disk with ECKD" do
        it "returns true" do
          devicegraph_stub("dasd_eckd.yml")

          expect(described_class.s390_secure_boot_supported?).to be true
        end
      end

      context "and zipl is on DASD disk with FBA (bsc#1270367)" do
        it "returns false" do
          devicegraph_stub("dasd_fba.yml")

          expect(described_class.s390_secure_boot_supported?).to be false
        end
      end

      context "and has_secure is 1" do
        context "and zipl is on a SCSI disk" do
          it "returns true" do
            allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return("1")
            allow(Bootloader::Systeminfo).to receive(:scsi?).and_return(true)
            expect(described_class.s390_secure_boot_supported?).to be true
          end
        end

        context "and zipl is not on a SCSI disk" do
          it "returns false" do
            allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return("1")
            allow(Bootloader::Systeminfo).to receive(:scsi?).and_return(false)
            expect(described_class.s390_secure_boot_supported?).to be false
          end
        end
      end

      context "and has_secure is 0" do
        it "returns false" do
          allow(File).to receive(:read).with("/sys/firmware/ipl/has_secure", 1).and_return("0")
          expect(described_class.s390_secure_boot_supported?).to be false
        end
      end
    end

    context "if arch is x86_64" do
      let(:arch) { "x86_64" }

      it "returns false" do
        expect(described_class.s390_secure_boot_supported?).to be false
      end
    end
  end

  describe ".s390_secure_boot_active?" do
    context "if arch is s390x" do
      let(:arch) { "s390_64" }

      it "returns false" do
        expect(described_class.s390_secure_boot_active?).to be false
      end
    end
  end

  describe ".nvram_available?" do
    context "if arch is ppc" do
      let(:arch) { "ppc" }

      it "returns true" do
        expect(described_class.nvram_available?).to be true
      end
    end
    context "if arch is ppc64" do
      let(:arch) { "ppc64" }

      it "returns true" do
        expect(described_class.nvram_available?).to be true
      end
    end
    context "if bootloader is grub2-efi" do
      it "returns true" do
        expect(described_class.nvram_available?("grub2-efi")).to be true
      end
    end
  end

  describe ".writable_efivars?" do
    it "returns false if UEFI is not available" do
      allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(false)
      allow_any_instance_of(Y2Storage::Arch).to receive(:efibootmgr?).and_return(true)

      expect(described_class.writable_efivars?).to eq false
    end

    it "returns false if UEFI variables are not writable" do
      allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(true)
      allow_any_instance_of(Y2Storage::Arch).to receive(:efibootmgr?).and_return(false)

      expect(described_class.writable_efivars?).to eq false
    end

    it "returns true if UEFI variables are writable" do
      allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(true)
      allow_any_instance_of(Y2Storage::Arch).to receive(:efibootmgr?).and_return(true)

      expect(described_class.writable_efivars?).to eq true
    end
  end
end
