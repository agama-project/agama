# frozen_string_literal: true

# File:
#      modules/BootStorage.ycp
#
# Module:
#      Bootloader installation and configuration
#
# Summary:
#      Module includes specific functions for handling storage data.
#      The idea is handling all storage data necessary for bootloader
#      in one module.
#
# Authors:
#      Jozef Uhliarik <juhliarik@suse.cz>
#

require "yast"
require "storage"
require "y2storage"
require "bootloader/udev_mapping"
require "bootloader/exceptions"

module Yast
  class BootStorageClass < Module
    include Yast::Logger

    # Moint point for /boot. If there is not separated /boot, / is used instead.
    # @return [Y2Storage::Filesystem]
    def boot_filesystem
      detect_disks

      @boot_fs
    end

    # Moint point for /.
    # @return [Y2Storage::Filesystem]
    def root_filesystem
      detect_disks

      @root_fs
    end

    def main
      textdomain "bootloader"

      Yast.import "Arch"
      Yast.import "Mode"
      Yast.import "Kernel"

      # FATE#305008: Failover boot configurations for md arrays with redundancy
      # list <string> includes physical disks used for md raid

      @md_physical_disks = []

      # Revision to recognize if cached values are still valid
      @storage_revision = nil
    end

    def storage_changed?
      @storage_revision != Y2Storage::StorageManager.instance.staging_revision
    end

    def staging
      Y2Storage::StorageManager.instance.staging
    end

    # Returns if any of boot disks has gpt
    def gpt_boot_disk?
      boot_disks.any? { |d| d.gpt? }
    end

    # Returns detected gpt disks
    # @param devices[Array<String>] devices to inspect, can be disk, partition or its udev links
    # @return [Array<String>] gpt disks only
    def gpt_disks(devices)
      targets = devices.map do |dev_name|
        staging.find_by_any_name(dev_name) or handle_unknown_device(dev_name)
      end
      boot_disks = targets.each_with_object([]) { |t, r| r.concat(stage1_disks_for(t)) }

      result = boot_disks.select { |disk| disk.gpt? }

      log.info "Found these gpt boot disks: #{result.inspect}"

      result.map(&:name)
    end

    # Sets properly boot, root and mbr disk.
    # resets disk configuration. Clears cache from #detect_disks
    def reset_disks
      @boot_fs = nil
      @root_fs = nil
    end

    def prep_partitions
      partitions = Y2Storage::Partitionable.all(staging).map(&:prep_partitions).flatten
      log.info "detected prep partitions #{partitions.inspect}"
      partitions
    end

    # Get map of swap partitions
    # @return a map where key is partition name and value its size in KiB
    def available_swap_partitions
      ret = {}

      mounted = Y2Storage::MountPoint.find_by_path(staging, Y2Storage::MountPoint::SWAP_PATH.to_s)
      if mounted.empty?
        log.info "No mounted swap found, using fallback."
        staging.filesystems.select { |f| f.type.is?(:swap) }.each do |swap|
          blk_device = swap.blk_devices[0]
          ret[blk_device.name] = blk_device.size.to_i / 1024
        end
      else
        log.info "Mounted swap found: #{mounted.inspect}"
        mounted.each do |mp|
          blk_device = mp.filesystem.blk_devices[0]
          ret[blk_device.name] = blk_device.size.to_i / 1024
        end
      end

      log.info "Available swap partitions: #{ret}"
      ret
    end

    # Ram size in KiB
    #
    # @return [Intenger]
    def ram_size
      Y2Storage::StorageManager.instance.arch.ram_size / 1024
    end

    def encrypted_boot?
      fs = boot_filesystem
      log.info "boot mp = #{fs.inspect}"
      # check if fs is on an encryption
      result = fs.ancestors.any? { |a| a.is?(:encryption) }

      log.info "encrypted_boot? = #{result}"

      result
    end

    # Find the devices (disks or partitions)
    # to whose boot records we should put stage1.
    #
    # In simple setups it will be one device, but for RAIDs and LVMs and other
    # multi-device setups we need to put stage1 to *all* the underlying boot
    # records so that the (Legacy) BIOS does not have a chance to pick
    # an empty BR to boot from. See bsc#1072908.
    #
    # @param [String] dev_name device name including udev links
    # @return [Array<Y2Storage::Device>] list of suitable devices
    def stage1_devices_for_name(dev_name)
      device = staging.find_by_any_name(dev_name)
      handle_unknown_device(dev_name) unless device

      if device.is?(:partition) || device.is?(:filesystem)
        stage1_partitions_for(device)
      else
        stage1_disks_for(device)
      end
    end

    # Find the partitions to whose boot records we should put stage1.
    # (In simple setups it will be one partition)
    # @param [Y2Storage::Device] device to check
    #   eg. a Y2Storage::Filesystems::Base (for a new installation)
    #   or a Y2Storage::Partition (for an upgrade)
    # @return [Array<Y2Storage::Device>] devices suitable for stage1
    def stage1_partitions_for(device)
      # so how to do search? at first find first partition with parents
      # that is on disk or multipath (as ancestors method is not sorted)
      partitions = select_ancestors(device) do |ancestor|
        if ancestor.is?(:partition)
          partitionable = ancestor.partitionable
          partitionable.is?(:disk) || partitionable.is?(:multipath) || partitionable.is?(:bios_raid)
        else
          false
        end
      end

      partitions.uniq!

      log.info "stage1 partitions for #{device.inspect} are #{partitions.inspect}"

      partitions
    end

    # If the passed partition is a logical one (sda7),
    # return its extended "parent" (sda4), otherwise return the argument
    def extended_for_logical(partition)
      partition.type.is?(:logical) ? extended_partition(partition) : partition
    end

    # Find the disks to whose MBRs we should put stage1.
    # (In simple setups it will be one disk)
    # @param [Y2Storage::Device] device to check
    #   eg. a Y2Storage::Filesystems::Base (for a new installation)
    #   or a Y2Storage::Disk (for an upgrade)
    # @return [Array<Y2Storage::Device>] devices suitable for stage1
    def stage1_disks_for(device)
      # Usually we want just the ancestors, but in the upgrade case
      # we may start with just 1 of multipath wires and have to
      # traverse descendants to find the Y2Storage::Multipath to use.
      component = [device] + device.ancestors + device.descendants

      # The simple case: just get the disks.
      disks = component.select { |a| a.is?(:disk) }
      # Eg. 2 Disks are parents of 1 Multipath, the disks are just "wires"
      # to the real disk.
      multipaths = component.select { |a| a.is?(:multipath) }
      multipath_wires = multipaths.each_with_object([]) { |m, r| r.concat(m.parents) }
      log.info "multipath devices #{multipaths.inspect} and its wires #{multipath_wires.inspect}"

      # And same for bios raids
      bios_raids = component.select { |a| a.is?(:bios_raid) }
      # raid can be more complex, so we need not only direct parents but all
      # ancestors involved in RAID
      raid_members = bios_raids.each_with_object([]) { |m, r| r.concat(m.ancestors) }
      log.info "bios_raids devices #{bios_raids.inspect} and its members #{raid_members.inspect}"

      result = multipaths + disks + bios_raids - multipath_wires - raid_members

      log.info "stage1 disks for #{device.inspect} are #{result.inspect}"

      result
    end

    # shortcut to get stage1 disks for /boot
    def boot_disks
      stage1_disks_for(boot_filesystem)
    end

    # shortcut to get stage1 partitions for /boot
    def boot_partitions
      stage1_partitions_for(boot_filesystem)
    end

    # shortcut to get stage1 partitions for /
    def root_partitions
      stage1_partitions_for(root_filesystem)
    end

    def propose_resume
      swap_parts = Yast::BootStorage.available_swap_partitions
      largest_swap_name, largest_swap_size = (swap_parts.max_by { |_part, size| size } || [])

      propose = Yast::Kernel.propose_hibernation? && largest_swap_name

      return "" unless propose

      if largest_swap_size < Yast::BootStorage.ram_size
        log.info "resume parameter is not added because swap (#{largest_swap_name}) is too small"

        return ""
      end

      # try to use label or udev id for device name... FATE #302219
      ::Bootloader::UdevMapping.to_mountby_device(largest_swap_name)
    end

  private

    def detect_disks
      return if @boot_fs && @root_fs && !storage_changed? # quit if already detected

      @root_fs = find_mountpoint("/")
      @boot_fs = find_mountpoint("/boot")
      @boot_fs ||= @root_fs

      raise ::Bootloader::NoRoot, "Missing '/' mount point" unless @boot_fs && @root_fs

      log.info "boot fs #{@boot_fs.inspect}"
      log.info "root fs #{@root_fs.inspect}"

      @storage_revision = Y2Storage::StorageManager.instance.staging_revision
    end

    def extended_partition(partition)
      part = partition.partitionable.partitions.find { |p| p.type.is?(:extended) }
      return nil unless part

      log.info "Using extended partition instead: #{part.inspect}"
      part
    end

    # Find the filesystem mounted to given mountpoint.
    #
    # If the mountpoint is assigned to a Btrfs subvolume, it returns the
    # corresponding filesystem. That's specially relevant in cases like
    # bsc#1151748 or bsc#1124581, in which libstorage-ng gets confused by
    # non-standard Btrfs configurations.
    #
    # @param mountpoint [String]
    # @return [Y2Storage::Filesystems::Base, nil] nil if nothing is mounted in
    #   the given location
    def find_mountpoint(mountpoint)
      mp = Y2Storage::MountPoint.all(staging).find { |m| m.path == mountpoint }
      return nil unless mp

      mp.filesystem
    end

    # In a device graph, starting at *device* (inclusive), find the parents
    # that match *predicate*.
    # NOTE that once the predicate matches, the search stops **for that node**
    # but continues for other nodes.
    # @param device [Y2Storage::Device] starting point
    # @yieldparam [Y2Storage::Device]
    # @yieldreturn [Boolean]
    # @return [Array<Y2Storage::Device>]
    def select_ancestors(device, &predicate)
      results = []
      to_process = [device]
      until to_process.empty?
        candidate = to_process.pop
        if predicate.call(candidate)
          results << candidate
          next # done with this branch but continue on other branches
        end
        to_process.concat(candidate.parents)
      end
      results
    end

    # Handle an "unknown device" error: Raise an appropriate exception.
    # @param dev_name [String]
    def handle_unknown_device(dev_name)
      # rubocop:disable Style/GuardClause
      #
      # I flatly refuse to make my code LESS readable because of a third-rate
      # check tool. This is the CLASSIC use case for if...else, even if this
      # mindless rubocop thinks otherwise.
      #
      # 2019-02-06 shundhammer

      if dev_name =~ %r{/by-path/} # bsc#1122008, bsc#1116305
        raise ::Bootloader::BrokenByPathDeviceName, dev_name
      else
        raise ::Bootloader::BrokenConfiguration, "Unknown device #{dev_name}"
      end
      # rubocop:enable Style/GuardClause
    end
  end

  BootStorage = BootStorageClass.new
  BootStorage.main
end
