# frozen_string_literal: true

require "yast"
require "y2storage"
require "bootloader/grub2base"
require "bootloader/mbr_update"
require "bootloader/device_map"
require "bootloader/stage1"
require "bootloader/grub_install"
require "bootloader/systeminfo"
require "bootloader/pmbr"

Yast.import "Arch"
Yast.import "BootStorage"
Yast.import "HTML"

module Bootloader
  # Represents non-EFI variant of GRUB2
  class Grub2 < Grub2Base
    attr_reader :device_map

    def initialize
      super

      textdomain "bootloader"
      @stage1 = Stage1.new
      @grub_install = GrubInstall.new(efi: false)
      @device_map = DeviceMap.new
    end

    # Read settings from disk, overwritting already set values
    def read
      super

      begin
        stage1.read
      rescue Errno::ENOENT
        # grub_installdevice is not part of grub2 rpm, so it doesn't need to exist.
        # In such case ignore exception and use empty @stage1
        log.info "grub_installdevice does not exist. Using empty one."
        @stage1 = Stage1.new
      end

      begin
        # device map is needed only for legacy boot on intel
        device_map.read if Yast::Arch.x86_64 || Yast::Arch.i386
      rescue Errno::ENOENT
        # device map is only optional part of grub2, so it doesn't need to exist.
        # In such case ignore exception and use empty device map
        log.info "grub2/device.map does not exist. Using empty one."
        @device_map = DeviceMap.new
      end
    end

    # Write bootloader settings to disk
    # @return [Boolean] true on success
    def write(etc_only: false)
      # super have to called as first as grub install require some config writen in ancestor
      super

      device_map.write if (Yast::Arch.x86_64 || Yast::Arch.i386) && !etc_only

      # set it only for gpt disk bsc#1008092
      Pmbr.write_none_efi(pmbr_action, stage1)

      # powernv must not call grub2-install (bnc#970582)
      if !Yast::Arch.board_powernv
        if !etc_only
          failed = @grub_install.execute(
            devices: stage1.devices, secure_boot: secure_boot, update_nvram: update_nvram
          )
          failed.each { |f| stage1.remove_device(f) }
        end
        # write stage1 location
        stage1.write
      end
      # Do some mbr activations ( s390 do not have mbr nor boot flag on its disks )
      # powernv do not have prep partition, so we do not have any partition to activate (bnc#970582)
      MBRUpdate.new.run(stage1) if !Yast::Arch.s390 && !Yast::Arch.board_powernv && !etc_only
    end

    def propose
      super

      stage1.propose
      # for GPT add protective MBR flag otherwise some systems won't
      # boot, safer option for legacy booting (bnc#872054)
      self.pmbr_action = :add
      log.info "proposed pmbr_action #{pmbr_action}."
      device_map.propose if Yast::Arch.x86_64 || Yast::Arch.i386
    end

    def merge(other)
      super

      @device_map = other.device_map if !other.device_map.empty?

      stage1.merge(other.stage1)
    end

    # Display bootloader summary
    # @return a list of summary lines
    def summary(simple_mode: false)
      result = [
        Yast::Builtins.sformat(
          _("Boot Loader Type: %1"),
          "GRUB2"
        )
      ]

      result.concat(boot_flags_summary)

      locations_val = locations
      if !locations_val.empty?
        result << format(
          _("Write Boot Code To: %s"),
          locations_val.join(", ")
        )
      end

      # it is necessary different summary for autoyast and installation
      # other mode than autoyast on running system
      # both ppc and s390 have special devices for stage1 so it do not make sense
      # allow change of location to MBR or boot partition (bnc#879107)
      no_location = simple_mode || Yast::Arch.ppc || Yast::Arch.s390 || Yast::Mode.config
      result << url_location_summary unless no_location

      order_sum = disk_order_summary
      result << order_sum unless order_sum.empty?

      result
    end

    def name
      "grub2"
    end

    def packages
      res = super
      res << "grub2"
      res << "syslinux" if include_syslinux_package?
      res
    end

    # FIXME: refactor with injection like super(prewrite: prewrite, sysconfig = ...)
    def write_sysconfig(prewrite: false)
      sysconfig = Bootloader::Sysconfig.new(
        bootloader: name, secure_boot: secure_boot, update_nvram: update_nvram
      )
      prewrite ? sysconfig.pre_write : sysconfig.write
    end

  private

    # Checks if syslinux package should be included
    #
    # Needed for generic_mbr binary files, but it must not be required in inst-sys as inst-sys have
    # it itself (bsc#1004229).
    #
    # @return [Boolean] true if syslinux package should be included; false otherwise
    def include_syslinux_package?
      return false if Yast::Stage.initial

      stage1.generic_mbr?
    end

    def devicegraph
      Y2Storage::StorageManager.instance.staging
    end

    def disk_order_summary
      return "" if Yast::Arch.s390

      return "" if device_map.size < 2

      Yast::Builtins.sformat(
        # part of summary, %1 is a list of hard disks device names
        _("Order of Hard Disks: %1"),
        device_map.disks_order.join(", ")
      )
    end

    # Gets all locations where stage1 will be written
    def locations
      locations = []

      partition_location = Yast::BootStorage.boot_partitions.map(&:name).join(", ")
      locations << partition_location if stage1.boot_partition?
      if stage1.extended_boot_partition?
        partitions = Yast::BootStorage.boot_partitions.map do |partition|
          Yast::BootStorage.extended_for_logical(partition).name
        end
        locations << partitions.join(", ")
      end
      locations << Yast::BootStorage.boot_disks.map(&:name).join(", ") if stage1.mbr?
      locations << stage1.custom_devices if !stage1.custom_devices.empty?

      locations
    end

    def mbr_line
      # TRANSLATORS: summary line where %s is disk specified, can be more disks, separated by comma
      res = if stage1.mbr?
        _(
          "Write it into MBR of %s (<a href=\"disable_boot_mbr\">do not write</a>)"
        )
      # TRANSLATORS: summary line where %s is disk specified, can be more disks, separated by comma
      else
        _(
          "Do not write it into MBR of %s (<a href=\"enable_boot_mbr\">write</a>)"
        )
      end

      format(res, Yast::BootStorage.boot_disks.map(&:name).join(", "))
    end

    def partition_line
      # TRANSLATORS: summary line where %s is partition specified, can be more disks,
      # separated by comma
      res = if stage1.boot_partition?
        _(
          "Write it into partition with /boot - %s " \
          "(<a href=\"disable_boot_boot\">do not write</a>)"
        )
      # TRANSLATORS: summary line where %s is partition specified, can be more disks,
      # separated by comma
      else
        _(
          "Do not write it into partition with /boot - %s " \
          "(<a href=\"enable_boot_boot\">write</a>)"
        )
      end
      format(res, Yast::BootStorage.boot_partitions.map(&:name).join(", "))
    end

    def logical_partition_line
      # TRANSLATORS: summary line where %s is partition specified, can be more disks,
      # separated by comma
      res = if stage1.boot_partition?
        _(
          "Write it into logical partition with /boot - %s " \
          "(<a href=\"disable_boot_boot\">do not write</a>)"
        )
      # TRANSLATORS: summary line where %s is partition specified, can be more disks,
      # separated by comma
      else
        _(
          "Do not write it into logical partition with /boot - %s " \
          "(<a href=\"enable_boot_boot\">write</a>)"
        )
      end
      format(res, Yast::BootStorage.boot_partitions.map(&:name).join(", "))
    end

    def extended_partition_line
      # TRANSLATORS: summary line where %s is partition specified, can be more disks,
      # separated by comma
      res = if stage1.extended_boot_partition?
        _(
          "Write it into extended partition with /boot - %s " \
          "(<a href=\"disable_boot_extended\">do not write</a>)"
        )
      # TRANSLATORS: summary line where %s is partition specified, can be more disks,
      # separated by comma
      else
        _(
          "Do not write it into extended partition with /boot - %s " \
          "(<a href=\"enable_boot_extended\">write</a>)"
        )
      end

      partitions = Yast::BootStorage.boot_partitions.map do |partition|
        Yast::BootStorage.extended_for_logical(partition).name
      end
      format(res, partitions.join(", "))
    end

    # FATE#303643 Enable one-click changes in bootloader proposal
    #
    #
    def url_location_summary
      log.info "Prepare url summary for GRUB2"
      line = +"<ul><li>"
      line << mbr_line
      line << "</li>\n"

      # do not allow to switch on boot from partition that do not support it
      if stage1.can_use_boot?
        line << "<li>"
        if stage1.logical_boot?
          line << extended_partition_line
          line << "</li>"
          line << "<li>"
          line << logical_partition_line
        else
          line << partition_line
        end
        line << "</li>"
      end

      if stage1.devices.empty?
        # no location chosen, so warn user that it is problem unless he is sure
        msg = _("Warning: No location for boot code selected." \
                "Unless you know what you are doing please select above location.")
        line << "<li>" << Yast::HTML.Colorize(msg, "red") << "</li>"
      end

      line << "</ul>"

      # TRANSLATORS: title for list of location proposals
      _("Boot Code: %s") % line
    end

    # summary for various boot flags
    def boot_flags_summary
      result = []
      result << secure_boot_summary if Systeminfo.secure_boot_available?(name)
      result << update_nvram_summary if Systeminfo.nvram_available?(name)

      result
    end
  end
end
