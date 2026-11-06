# frozen_string_literal: true

require "yast"
require "y2storage"
require "bootloader/bootloader_factory"
require "bootloader/sysconfig"
require "yast2/execute"

Yast.import "Arch"
Yast.import "BootStorage"

module Bootloader
  # Provide system and architecture dependent information
  class Systeminfo
    class << self
      include Yast::Logger

      # Check current secure boot state.
      #
      # This reflects settings on OS level. If secure boot is not supported, it returns false.
      #
      # @return [Boolean] true if secure boot is currently active
      def secure_boot_active?
        secure_boot_supported? &&
          Sysconfig.from_system.secure_boot
      end

      # Check if secure boot is in principle supported.
      #
      # @return [Boolean] true if secure boot is (in principle) supported on this system
      def secure_boot_supported?
        # no shim for i386 (yet)
        return false if efi_arch == "i386"
        # no shim neither secure boot support for 32 bit arm nor riscv64 (bsc#1229070)
        return false if Yast::Arch.arm || Yast::Arch.riscv64

        efi_supported? || s390_secure_boot_supported? || ppc_secure_boot_supported?
      end

      # Check if secure boot is configurable with a bootloader.
      #
      # @param bootloader_name [String] bootloader name
      # @return [Boolean] true if secure boot setting is available with this bootloader
      def secure_boot_available?(bootloader_name)
        # no shim for i386 (yet)
        return false if efi_arch == "i386"
        # no shim neither secure boot support for 32 bit arm nor riscv64 (bsc#1229070)
        return false if Yast::Arch.arm || Yast::Arch.riscv64

        efi_used?(bootloader_name) || s390_secure_boot_available? || ppc_secure_boot_available?
      end

      # Check if mbr configurable with a bootloader.
      #
      # @param bootloader_name [String] bootloader name
      # @return [Boolean] true if available with this bootloader
      def generic_mbr_available?(bootloader_name)
        (Yast::Arch.x86_64 || Yast::Arch.i386) && !["grub2-efi",
                                                    "grub2-bls"].include?(bootloader_name)
      end

      # Check if loader location is configurable with a bootloader.
      #
      # @param bootloader_name [String] bootloader name
      # @return [Boolean] true if available with this bootloader
      def loader_location_available?(bootloader_name)
        (Yast::Arch.x86_64 || Yast::Arch.i386 || Yast::Arch.ppc) && bootloader_name == "grub2"
      end

      # Check if setting device map is available.
      #
      # @param bootloader_name [String] bootloader name
      # @return [Boolean] true if available with this bootloader
      def device_map?(bootloader_name)
        (Yast::Arch.x86_64 || Yast::Arch.i386) && !["grub2-efi",
                                                    "grub2-bls"].include?(bootloader_name)
      end

      # Check if the system is expected to have nvram - ie. update_nvram_active? makes a difference
      def nvram_available?(bootloader_name = nil)
        (bootloader_name ? efi_used?(bootloader_name) : efi_supported?) || Yast::Arch.ppc
      end

      def update_nvram_active?
        Sysconfig.from_system.update_nvram
      end

      # Check if UEFI will be used.
      #
      # param bootloader_name [String] bootloader name
      # @return [Boolean] true if UEFI will be used for booting with this bootloader
      def efi_used?(bootloader_name)
        ["grub2-efi", "systemd-boot", "grub2-bls"].include?(bootloader_name)
      end

      # Check if UEFI is available on this system.
      #
      # It need not currently be used. It should just be possible to put the
      # system into UEFI mode.
      #
      # @return [Boolean] true if system can (in principle) boot via UEFI
      def efi_supported?
        Yast::Arch.x86_64 || Yast::Arch.i386 || efi_mandatory?
      end

      # Check if EFI mandatory on this system.
      # @return [Boolean] true if system must boot via EFI
      def efi_mandatory?
        Yast::Arch.aarch64 || Yast::Arch.arm || Yast::Arch.riscv64
      end

      # Check if console settings are supported
      #
      # param bootloader_name [String] bootloader name
      # @return [Boolean] true if supported
      def console_supported?(bootloader_name)
        !Yast::Arch.s390 && bootloader_name != "grub2-bls"
      end

      # Check if hiding menu are supported
      #
      # param bootloader_name [String] bootloader name
      # @return [Boolean] true if supported
      def hiding_menu_supported?(bootloader_name)
        bootloader_name != "grub2-bls"
      end

      # Using bls timeout settings
      #
      # param bootloader_name [String] bootloader name
      # @return [Boolean] true if supported
      def bls_timeout_supported?(bootloader_name)
        bootloader_name == "grub2-bls"
      end

      # Check if setting password is supported
      #
      # param bootloader_name [String] bootloader name
      # @return [Boolean] true if supported
      def password_supported?(bootloader_name)
        bootloader_name != "grub2-bls"
      end

      # Check if shim-install should be used instead of grub2-install.
      #
      # param bootloader_name [String] bootloader name
      # param secure_boot [Boolean] secure boot setting
      # @return [Boolean] true if shim has to be used
      def shim_needed?(bootloader_name, secure_boot)
        (Yast::Arch.x86_64 || Yast::Arch.i386 || Yast::Arch.aarch64) &&
          secure_boot && efi_used?(bootloader_name)
      end

      # UEFI platform size (32 or 64 bits).
      #
      # On x86_64 systems both variants are possible.
      #
      # @return [Integer] platform size - or 0 if not applicable
      def efi_platform_size
        bits = File.read("/sys/firmware/efi/fw_platform_size").to_i
        log.info "EFI platform size: #{bits}"
        bits
      rescue StandardError
        0
      end

      # Effective UEFI architecture.
      #
      # Usually the same as the architecture except on x86_64 where it
      # depends on the platform size.
      #
      # @return [String] architecture name
      def efi_arch
        arch = Yast::Arch.architecture
        arch = "i386" if arch == "x86_64" && efi_platform_size == 32
        arch
      end

      # Check if secure boot is (in principle) available on an s390 machine.
      #
      # @return [Boolean] true if this is an s390 machine and it has secure boot support
      def s390_secure_boot_available?
        # see jsc#SLE-9425
        return false unless Yast::Arch.s390

        res = File.read("/sys/firmware/ipl/has_secure", 1)
        log.info "s390 has secure: #{res}"

        res == "1"
      rescue StandardError
        false
      end

      # Check if secure boot is supported with the current setup.
      #
      # The catch here is that secure boot works only with SCSI disks.
      #
      # @return [Boolean] true if this is an s390 machine and secure boot is
      #   supported with the current setup
      def s390_secure_boot_supported?
        return false unless Yast::Arch.s390

        zipl_dev = zipl_device
        # for ECKD DASD zipl install both modes, so secure boot can be always
        # enabled (jsc#PED-13734)
        return true if dasd?(zipl_dev)

        s390_secure_boot_available? && scsi?(zipl_dev)
      end

      # Check if secure boot is currently active on an s390 machine.
      #
      # The 'real' state, not any config file setting.
      #
      # @return [Boolean] true if 390x machine has secure boot enabled
      def s390_secure_boot_active?
        return false unless Yast::Arch.s390

        # see jsc#SLE-9425
        res = File.read("/sys/firmware/ipl/secure", 1)
        log.info "s390 secure: #{res}"

        res == "1"
      rescue StandardError
        false
      end

      # Return secure boot status on ppc
      #
      # nil - no support
      # 0   - disabled
      # 1   - enabled in audit-only mode
      # 2+  - enabled in enforcing mode
      def ppc_secure_boot
        # see bsc#1192764
        result = nil
        return nil unless Yast::Arch.ppc

        begin
          result = File.read("/proc/device-tree/ibm,secure-boot")
          result = result.unpack1("N")
          log.info "reading ibm,secure-boot result #{result}"
        rescue StandardError => e
          log.info "reading ibm,secure-boot failed with #{e}"
          result = nil
        end
        result
      end

      # Check if secure boot is (in principle) available on an ppc machine.
      #
      # @return [Boolean] true if this is an ppc machine and it has secure boot support
      def ppc_secure_boot_available?
        # see bsc#1192764
        !ppc_secure_boot.nil?
      end

      # Check if secure boot is supported with the current setup.
      #
      # @return [Boolean] true if this is an ppc machine and secure boot is
      #   supported with the current setup
      def ppc_secure_boot_supported?
        ppc_secure_boot_available?
      end

      # Check if secure boot is currently active on an ppc machine.
      #
      # The 'real' state, not any config file setting.
      #
      # @return [Boolean] true if ppc machine has secure boot enabled
      def ppc_secure_boot_active?
        # see bsc#1192764
        ppc_secure_boot.to_i > 0
      end

      # The partition where zipl is installed.
      #
      # @return [Y2Storage::Partition, NilClass] zipl partition
      def zipl_device
        staging = Y2Storage::StorageManager.instance.staging
        mountpoint =
          Y2Storage::MountPoint.find_by_path(staging, "/boot/zipl").first ||
          Y2Storage::MountPoint.find_by_path(staging, "/boot").first ||
          Y2Storage::MountPoint.find_by_path(staging, "/").first
        mountpoint.filesystem.blk_devices.first
      rescue StandardError
        nil
      end

      # Check if device is a SCSI device.
      #
      # param device [Y2Storage::Partition, NilClass] partition device (or nil)
      #
      # @return [Boolean] true if device is a SCSI device
      def scsi?(device)
        # checking if device name starts with 'sd' is not enough: it could
        # be a device mapper target (e.g. multipath)
        # see bsc#1171821
        device.name.start_with?("/dev/sd") || device.udev_ids.any?(/^scsi-/)
      rescue StandardError
        false
      end

      # Check if device is a ECKD DASD device.
      #
      # @see https://www.ibm.com/docs/en/linux-on-systems?topic=linux-secure-boot#secure_boot
      #
      # param device [Y2Storage::Partition, NilClass] partition device (or nil)
      #
      # @return [Boolean] true if device is a DASD device
      def dasd?(device)
        return false unless device

        if device.is?(:partition)
          disk = device.partitionable
          return false unless disk

          dasd?(disk)
        else
          device.is?(:dasd) && device.type == Y2Storage::DasdType::ECKD
        end
      end

      def efi?
        Y2Storage::Arch.new.efiboot?
      end

      # Checks if efivars exists and can be written
      # @see https://bugzilla.suse.com/show_bug.cgi?id=1174111#c37
      #
      # The point here is that without writable UEFI variables the UEFI boot
      # manager cannot (and must not) be updated.
      #
      # @return [Boolean] true if efivars are writable
      def writable_efivars?
        storage_arch = Y2Storage::Arch.new
        storage_arch.efiboot? && storage_arch.efibootmgr?
      end
    end
  end
end
