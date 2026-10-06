# frozen_string_literal: true

require "yast"
require "yast2/execute"
require "bootloader/systeminfo"

Yast.import "Arch"
Yast.import "Report"

module Bootloader
  # Wraps grub install script for easier usage.
  class GrubInstall
    include Yast::Logger
    include Yast::I18n

    def initialize(efi: false)
      @efi = efi
      @grub2_name = "grub2#{@efi ? "-efi" : ""}"
      textdomain "bootloader"
    end

    # Runs grub2 install command.
    #
    # @param devices[Array<String>] list of devices where grub2 should be installed.
    #   Ignored when grub2 does not need device.
    # @param secure_boot [Boolean] if secure boot variant should be used
    # @param update_nvram [Boolean] if bootloader entry should be added to nvram
    # @return [Array<String>] list of devices for which install failed
    def execute(devices: [], secure_boot: false, update_nvram: true)
      if secure_boot && !Systeminfo.secure_boot_available?(@grub2_name)
        # There might be some secure boot setting left over when the
        # bootloader had been switched.
        # Simply ignore it when it is not applicable instead of raising an
        # error.
        log.warn "Ignoring secure boot setting on this machine"
      end

      cmd = basic_cmd(secure_boot, update_nvram)

      if no_device_install?
        Yast::Execute.on_target(cmd)

        if non_removable_efi?
          cmd.delete("--removable")
          Yast::Execute.on_target(cmd)
        end
        []
      else
        return [] if devices.empty?

        last_failure = nil
        res = devices.select do |device|

          Yast::Execute.on_target!(cmd + [device])
          false
        rescue Cheetah::ExecutionFailed => e
          log.warn "Failed to install grub to device #{device}. #{e.inspect}"
          last_failure = e
          true

        end

        # Failed to install to all devices
        report_failure(last_failure) if res.size == devices.size

        res
      end
    end

  private

    attr_reader :efi

    def report_failure(exception)
      Yast::Report.Error(
        format(_(
                 "Installing GRUB2 to device failed.\n" \
                 "Command `%{command}`.\n" \
                 "Error output: %{stderr}"
               ), command: exception.commands.inspect, stderr: exception.stderr)
      )
    end

    # creates basic command for grub2 install without specifying any stage1
    # locations
    def basic_cmd(secure_boot, update_nvram)
      if Systeminfo.shim_needed?(@grub2_name, secure_boot)
        cmd = ["/usr/sbin/shim-install", "--config-file=/boot/grub2/grub.cfg"]
      else
        cmd = ["/usr/sbin/grub2-install", "--target=#{target}"]
        # Do skip-fs-probe to avoid error when embedding stage1
        # to extended partition
        cmd << "--force" << "--skip-fs-probe"
      end

      cmd << "--removable" if removable_efi?
      cmd << "--no-nvram" if !update_nvram

      if target == "powerpc-ieee1275"
        cmd << if secure_boot
          "--suse-force-signed"
        else
          "--suse-inhibit-signed"
        end
      end

      cmd
    end

    def removable_efi?
      # EFI has 2 boot paths. The default is that there is a target file listed
      # in the boot list. The boot list is stored in NVRAM and exposed as
      # efivars.
      #
      # If no entry in the boot list was bootable (or a removable media is in
      # the boot list), EFI falls back to removable media booting which loads
      # a default file from /efi/boot/boot.efi.
      #
      # On U-Boot EFI capable systems we do not have NVRAM because we would
      # have to store that on the same flash that Linux may be running on,
      # creating device ownership conflicts. So on those systems we instead have
      # to rely on the removable boot case.
      #
      # The easiest heuristic is that on "normal" EFI systems with working
      # NVRAM, there is at least one efi variable visible. On systems without
      # working NVRAM, we either see no efivars at all (booted via non-EFI entry
      # point) or there is no efi variable exposed. Install grub in the
      # removable location there.
      # Workaround for SLE15 SP2 - run always as removable on arm (bsc#1167015)
      Yast::Arch.aarch64 || Yast::Arch.arm || Yast::Arch.riscv64 ||
        (efi && !Systeminfo.writable_efivars?)
    end

    def non_removable_efi?
      # workaround for arm on SLE15 SP2 (bsc#1167015)
      # run grub2-install also non-removable if efi is there
      (Yast::Arch.aarch64 || Yast::Arch.arm || Yast::Arch.riscv64) &&
        Systeminfo.writable_efivars?
    end

    def no_device_install?
      Yast::Arch.s390 || efi
    end

    NON_EFI_TARGETS = {
      "i386"    => "i386-pc",
      "x86_64"  => "i386-pc", # x64 use same legacy boot for backward compatibility
      "s390_32" => "s390x-emu",
      "s390_64" => "s390x-emu",
      "ppc"     => "powerpc-ieee1275",
      "ppc64"   => "powerpc-ieee1275"
    }.freeze

    EFI_TARGETS = {
      "i386"    => "i386-efi",
      "x86_64"  => "x86_64-efi",
      "arm"     => "arm-efi",
      "aarch64" => "arm64-efi",
      "riscv64" => "riscv64-efi"
    }.freeze
    def target
      return @target if @target

      arch = Yast::Arch.architecture
      target = efi ? EFI_TARGETS[Systeminfo.efi_arch] : NON_EFI_TARGETS[arch]

      if !target
        raise "unsupported combination of architecture #{arch} and " \
              "#{efi ? "enabled" : "disabled"} EFI"
      end

      @target ||= target
    end
  end
end
