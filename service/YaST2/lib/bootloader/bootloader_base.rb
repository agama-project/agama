# frozen_string_literal: true

require "yast"
require "bootloader/sysconfig"

Yast.import "BootStorage"
Yast.import "Linuxrc"
Yast.import "Mode"
Yast.import "Package"

module Bootloader
  # Represents base for all kinds of bootloaders
  class BootloaderBase
    include Yast::I18n

    def initialize
      textdomain "bootloader"

      @read = false
      @proposed = false
      @initial_sysconfig = Sysconfig.from_system
    end

    # Prepares the system to (before write the configuration)
    #
    # Writes the new sysconfig and, when the Mode.normal is set, tries to install the required
    # packages. If user decides to cancel the installation, it restores the previous sysconfig.
    #
    # @return [Boolean] true whether the system could be prepared as expected;
    #                   false when user cancel the installation of needed packages
    def prepare
      write_sysconfig

      return true unless Yast::Mode.normal
      return true if Yast::Package.InstallAll(packages)

      restore_initial_sysconfig

      false
    end

    # writes configuration to target disk
    # @param etc_only [Boolean] true on transactional systems
    #   because /boot is read-only there
    def write(etc_only: false)
      return if etc_only

      # reset eventl. already installed systemd bootloader
      systemd_boot = BootloaderFactory.bootloader_by_name("systemd-boot")
      systemd_boot&.delete
    end

    # reads configuration from target disk
    def read
      @read = true
    end

    # Proposes new configuration
    def propose
      @proposed = true
    end

    # @return [Array<String>] description for proposal summary page for given bootloader
    def summary
      []
    end

    # @return true if configuration is already read
    def read?
      @read
    end

    # @return true if configuration is already proposed
    def proposed?
      @proposed
    end

    # @return [Array<String>] packages required to configure given bootloader
    def packages
      # require dracut to have initrd to be able to boot
      res = ["dracut"]

      # added kexec-tools fate#303395
      res << "kexec-tools" if include_kexec_tools_package?

      res
    end

    # done in common write but also in installation pre write as kernel update need it
    # @param prewrite [Boolean] true only in installation when scr is not yet switched
    def write_sysconfig(prewrite: false)
      sysconfig = Bootloader::Sysconfig.new(bootloader: name)
      prewrite ? sysconfig.pre_write : sysconfig.write
    end

    # merges other bootloader configuration into this one.
    # It have to be same bootloader type.
    def merge(other)
      raise "Invalid merge argument #{other.name} for #{name}" if name != other.name

      @read ||= other.read?
      @proposed ||= other.proposed? # rubocop:disable Naming/MemoizedInstanceVariableName
    end

  private

    # @return [Boolean] true when kexec-tools package should be included; false otherwise
    def include_kexec_tools_package?
      return false if Yast::Mode.live_installation

      Yast::Linuxrc.InstallInf("kexec_reboot") != "0"
    end

    # Writes the sysconfig readed in the initialization
    #
    # Useful to "rollback" sysconfig changes if something fails before finish writing the
    # configuration
    def restore_initial_sysconfig
      @initial_sysconfig.write
    end

    def status_string(status)
      if status
        _("enabled")
      else
        _("disabled")
      end
    end
  end
end
