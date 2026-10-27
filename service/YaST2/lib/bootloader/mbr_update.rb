# frozen_string_literal: true

require "yast"

require "bootloader/boot_record_backup"
require "yast2/execute"
require "y2storage"

Yast.import "Arch"
Yast.import "Package"
Yast.import "BootStorage"

module Bootloader
  # this class place generic MBR wherever it is needed
  # and also mark needed partitions with boot flag and legacy_boot
  # FIXME: make it single responsibility class
  class MBRUpdate
    include Yast::Logger

    # Update contents of MBR (active partition and booting code)
    def run(stage1)
      log.info "Stage1: #{stage1.inspect}"
      @stage1 = stage1

      create_backups

      # Rewrite MBR with generic boot code only if we do not plan to install
      # there bootloader stage1
      install_generic_mbr if stage1.generic_mbr? && !stage1.mbr?

      activate_partitions if stage1.activate?
    end

  private

    def devicegraph
      Y2Storage::StorageManager.instance.staging
    end

    def create_backups
      devices_to_backup = disks_to_rewrite.map(&:name) + @stage1.devices
      devices_to_backup.uniq!
      log.info "Creating backup of boot sectors of #{devices_to_backup}"
      backups = devices_to_backup.map do |d|
        ::Bootloader::BootRecordBackup.new(d)
      end
      backups.each(&:write)
    end

    def gpt?(disk)
      mbr_storage_object = devicegraph.disk_devices.find { |d| d.name == disk }
      raise "Cannot find in storage mbr disk #{disk}" unless mbr_storage_object

      mbr_storage_object.gpt?
    end

    GPT_MBR = "/usr/share/syslinux/gptmbr.bin"
    DOS_MBR = "/usr/share/syslinux/mbr.bin"
    def generic_mbr_file_for(disk)
      disk.gpt? ? GPT_MBR : DOS_MBR
    end

    def install_generic_mbr
      Yast::Package.Install("syslinux") unless Yast::Stage.initial

      disks_to_rewrite.each do |disk|
        log.info "Copying generic MBR code to #{disk}"
        command = [
          "/bin/dd",
          # it is a a bit magic number, but MBR size is 512B and we copy only bootstrap area
          # see https://en.wikipedia.org/wiki/Master_boot_record#Sector_layout
          # so we should copy 446 bytes of generic boot code, but we
          # added fix 446 -> 440 for Vista booting problem bnc #396444
          # ( as modern MBRs have 440-446 for disk signature and copy protected flag,
          #   see at same wiki link )
          "bs=440",
          "count=1",
          "if=#{generic_mbr_file_for(disk)}",
          "of=#{disk.name}"
        ]
        Yast::Execute.locally(*command)
      end
    end

    def set_parted_flag(disk, part_num, flag)
      # we need at first clear this flag to avoid multiple flags (bnc#848609)
      reset_flag(disk, flag)

      # and then set it
      command = ["/usr/sbin/parted", "-s", disk, "set", part_num, flag, "on"]
      Yast::Execute.locally(*command)
    end

    def reset_flag(disk, flag)
      command = ["/usr/sbin/parted", "-sm", disk, "print"]
      out = Yast::Execute.locally(*command, stdout: :capture)

      partitions = out.lines.select do |line|
        values = line.split(":")
        values[6]&.match(/(?:\s|\A)#{flag}/)
      end
      partitions.map! { |line| line.split(":").first }

      partitions.each do |part_num|
        command = ["/usr/sbin/parted", "-s", disk, "set", part_num, flag, "off"]
        Yast::Execute.locally(*command)
      end
    end

    def can_activate_partition?(disk, partition)
      # if primary partition on old DOS MBR table, GPT do not have such limit

      !(Yast::Arch.ppc && disk.gpt?) && !partition.is?(:logical)
    end

    def activate_partitions
      partitions_to_activate.each do |partition|
        num = partition.number
        disk = partition.partitionable
        raise "INTERNAL ERROR: Data for partition to activate is invalid." if num.nil? || disk.nil?

        next unless can_activate_partition?(disk, partition)

        log.info "Activating partition #{partition.inspect}"
        # set corresponding flag only bnc#930903
        if disk.gpt?
          # for legacy_boot storage_ng do not reset others, so lets
          # do it manually
          set_parted_flag(disk.name, num, "legacy_boot")
        else
          set_parted_flag(disk.name, num, "boot")
        end
      end
    end

    # Get the list of MBR disks that should be rewritten by generic code
    # if user wants to do so
    # @return a list of device names to be rewritten
    def disks_to_rewrite
      # find the MBRs on the same disks as the devices underlying the boot
      # devices; if for any of the "underlying" or "base" devices no device
      # for acessing the MBR can be determined, include mbr_disk in the list
      @disks_to_rewrite ||= Yast::BootStorage.boot_disks
    end

    # List of partition for disk that can be used for setting boot flag
    def activatable_partitions(disk)
      return [] unless disk

      # do not select swap and do not select BIOS grub partition
      # as it clear its special flags (bnc#894040)
      disk.partitions.reject { |p| p.id.is?(:swap, :bios_boot) }
    end

    # Get a list of partitions to activate if user wants to activate
    # boot partition
    # @return a list of partitions to activate
    def partitions_to_activate
      result = @stage1.devices.map { |dev| devicegraph.find_by_any_name(dev) }
      result.compact!

      result.map! do |device|
        if device.respond_to?(:partitions) # so it is disk
          device = device.partitions.find { |p| !p.id.is?(:swap, :bios_boot) }
        end
        res = device ? Yast::BootStorage.extended_for_logical(device) : nil
        log.info "partition to activate for #{device.inspect} is #{res.inspect}"
        res
      end

      result.compact!

      result.uniq
    end
  end
end
