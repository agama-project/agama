# frozen_string_literal: true

require "yast"
require "bootloader/grub2base"
require "bootloader/grub_install"
require "bootloader/sysconfig"
require "bootloader/pmbr"
require "y2storage"

Yast.import "Arch"
Yast.import "BootStorage"

module Bootloader
  # Represents grub2 bootloader with efi target
  class Grub2EFI < Grub2Base
    include Yast::Logger

    def initialize
      super

      textdomain "bootloader"

      @grub_install = GrubInstall.new(efi: true)
    end

    # Write bootloader settings to disk
    def write(etc_only: false)
      # super have to called as first as grub install require some config written in ancestor
      super

      Pmbr.write_efi(pmbr_action)

      @grub_install.execute(secure_boot: secure_boot, update_nvram: update_nvram) unless etc_only

      true
    end

    def propose
      super

      # for UEFI always remove PMBR flag on disk (bnc#872054)
      self.pmbr_action = :remove

      # linuxefi/initrdefi are available on x86 only
      grub_default.generic_set("GRUB_USE_LINUXEFI",
        (Yast::Arch.x86_64 || Yast::Arch.i386) ? "true" : "false")
    end

    # Display bootloader summary
    # @return a list of summary lines
    def summary(*)
      result = [
        Yast::Builtins.sformat(
          _("Boot Loader Type: %1"),
          "GRUB2 EFI"
        )
      ]

      result << secure_boot_summary if Systeminfo.secure_boot_available?(name)
      result << update_nvram_summary if Systeminfo.nvram_available?(name)

      result
    end

    def name
      "grub2-efi"
    end

    def packages
      res = super

      case Systeminfo.efi_arch
      when "i386"
        res << "grub2-i386-efi"
      when "x86_64"
        res << "grub2-x86_64-efi"
        res << "shim" << "mokutil" if secure_boot
      when "arm"
        res << "grub2-arm-efi"
      when "aarch64"
        res << "grub2-arm64-efi"
        res << "shim" << "mokutil" if secure_boot
      when "riscv64"
        res << "grub2-riscv64-efi"
      else
        log.warn "Unknown architecture #{Yast::Arch.architecture} for EFI"
      end

      res
    end

    # overwrite BootloaderBase version to save secure boot
    def write_sysconfig(prewrite: false)
      sysconfig = Bootloader::Sysconfig.new(bootloader: name,
        secure_boot: secure_boot, update_nvram: update_nvram)
      prewrite ? sysconfig.pre_write : sysconfig.write
    end
  end
end
