# Copyright (c) [2015-2025] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of version 2 of the GNU General Public License as published
# by the Free Software Foundation.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

require "yast"
require "storage"
require "y2packager/repository"
require "y2storage/disk_size"
require "y2storage/blk_device"
require "y2storage/lvm_pv"
require "y2storage/partition_id"

Yast.import "Arch"

module Y2Storage
  #
  # Class to analyze the disk devices (the storage setup) of the existing system:
  # Check the existing disk devices (Dasd or Disk) and their partitions what candidates
  # there are to install on, typically eliminate the installation media from that list
  # (unless there is no other disk), check if there already are any
  # partitions that look like there was a Linux system previously installed
  # on that machine, check if there is a Windows partition that could be
  # resized.
  #
  # Some of those operations involve trying to mount the underlying filesystem.
  class DiskAnalyzer
    include Yast::Logger

    # Constructor
    #
    # @param devicegraph [Devicegraph]
    def initialize(devicegraph)
      @devicegraph = devicegraph
    end

    # Whether there is a Windows system
    #
    # @param disks [Disk, String] disks to analyze. All disks by default.
    def windows_system?(*disks)
      return false unless windows_architecture?

      filesystems_collection(*disks).any?(&:windows_system?)
    end

    # Partitions containing an installation of MS Windows
    #
    # This involves mounting any Windows-like partition to check if there are
    # some typical directories (/windows/system32).
    #
    # @param disks [Disk, String] disks to analyze. All disks by default.
    # @return [Array<Partition>]
    def windows_partitions(*disks)
      return [] unless windows_architecture?

      windows_filesystems(*disks).flat_map(&:blk_devices)
    end

    # Partitions with a proper Linux partition Id
    #
    # @see PartitionId.linux_system_ids
    #
    # @param disks [Disk, String] disks to analyze. All disks by default.
    # @return [Array<Partition>]
    def linux_partitions(*disks)
      disks_collection(*disks).flat_map(&:linux_system_partitions)
    end

    # Name of installed systems
    #
    # @param disks [Disk, String] disks to analyze. All disks by default.
    # @return [Array<String>] release names
    def installed_systems(*disks)
      windows_systems(*disks) + linux_systems(*disks)
    end

    # Name of installed Windows systems
    #
    # @param disks [Disk, String] disks to analyze. All disks by default.
    # @return [Array<String>] release names
    def windows_systems(*disks)
      windows_filesystems(*disks).map(&:system_name).compact
    end

    # Release name of installed Linux systems
    #
    # @param disks [Disk, String] disks to analyze. All disks by default.
    # @return [Array<String>] release names
    def linux_systems(*disks)
      linux_suitable_filesystems(*disks).map(&:release_name).compact
    end

    # All fstabs found in the system
    #
    # Note that all Linux filesystems are considered here, including filesystems over LVM LVs, see
    # {#all_linux_suitable_filesystems}.
    #
    # @return [Array<Fstab>]
    def fstabs
      @fstabs ||= all_linux_suitable_filesystems.map(&:fstab).compact
    end

    # All crypttabs found in the system
    #
    # Note that all Linux filesystems are considered here, including filesystems over LVM LVs, see
    # {#all_linux_suitable_filesystems}.
    #
    # @return [Array<Crypttab>]
    def crypttabs
      @crypttabs ||= all_linux_suitable_filesystems.map(&:crypttab).compact
    end

    # Disks that are suitable for installing Linux.
    #
    # Finds devices (disk devices and software RAIDs) that are suitable for installing Linux
    #
    # From fate#326573 on, software RAIDs with partition table or without children are also
    # considered as valid candidates. But since that's a controversial behavior that has
    # caused collateral problems (e.g. bsc#1166258), those software RAIDs are only taken
    # into account when booting in EFI mode.
    #
    # @return [Array<BlkDevice>] candidate
    def candidate_disks
      return @candidate_disks if @candidate_disks

      @candidate_disks = candidate_software_raids + candidate_disk_devices

      log.info("Found candidate disks: #{@candidate_disks}")

      @candidate_disks
    end

    # Checks whether a device can be used for the installation
    #
    # A device is visible for installation purposes if no filesystem belonging to the device is
    # mounted and the device does not contain a repository for installation.
    #
    # Moreover, RAM disks are also discarded.
    #
    # @param device [BlkDevice]
    # @return [Boolean]
    def available_device?(device)
      !contain_mounted_filesystem?(device) &&
        !contain_installation_repository?(device) &&
        !device.name.match?(/^\/dev\/ram\d+$/)
    end

    # Checks whether it makes sense to create the boot-related partitions at the given device
    #
    # Apart from the disk devices, some software RAIDs are considered as acceptable under some
    # circumstances. See {#candidate_disks} for extra explanations (e.g. the relevance of EFI) and for
    # Fate/Bugzilla references.
    #
    # @param device [BlkDevice]
    # @return [Boolean]
    def supports_boot_partitions?(device)
      return true if device.is?(:disk_device)
      return false unless arch.efiboot?

      device.is?(:software_raid) && (device.partition_table? || device.children.empty?)
    end

    # Look up devicegraph element by device name.
    #
    # @return [Device]
    def device_by_name(name)
      # Using BlkDevice because it is necessary to search in both, Dasd and Disk.
      BlkDevice.find_by_name(devicegraph, name)
    end

    private

    # @return [Devicegraph]
    attr_reader :devicegraph

    # Whether the architecture of the system is supported by MS Windows
    #
    # @return [Boolean]
    def windows_architecture?
      # Should we include ARM here?
      Yast::Arch.x86_64 || Yast::Arch.i386
    end

    # Obtains a list of disk devices, software RAIDs, and bcaches
    #
    # @see #default_disks_collection for default values when disks are not given
    #
    # @param disks [Array<BlkDevice, String>] blk device to analyze.
    # @return [Array<BlkDevice>] a list of blk devices
    def disks_collection(*disks)
      return default_disks_collection if disks.empty?

      disks.map! { |d| d.is_a?(String) ? BlkDevice.find_by_name(devicegraph, d) : d }
      disks.compact
    end

    # The default disks collection to be analyzed
    #
    # @note software RAIDs and bcache also could be analyzed because it is possible to find a Linux
    # system installed on them.
    #
    # @see #disks_collection
    def default_disks_collection
      devicegraph.disk_devices + devicegraph.software_raids + devicegraph.bcaches
    end

    # All partitions from the given disks
    #
    # @see #disks_collection
    #
    # @param disks [Array<BlkDevice, String>]
    # @return [Array<Partition>]
    def partitions_collection(*disks)
      disks_collection(*disks).flat_map(&:partitions)
    end

    # All filesystems from the given disks
    #
    # @see #disks_collection
    # @see #partitions_collection
    #
    # @param disks [Array<BlkDevice, String>]
    # @return [Array<Filesystems::BlkFilesystem>]
    def filesystems_collection(*disks)
      blk_devices = disks_collection(*disks) + partitions_collection(*disks)

      blk_devices.map(&:filesystem).compact
    end

    # All filesystems that contain a Windows system from the given disks
    #
    # @see #filesystems_collection
    #
    # @param disks [Array<BlkDevice, String>]
    # @return [Array<Filesystems::BlkFilesystem>]
    def windows_filesystems(*disks)
      filesystems_collection(*disks).select(&:windows_system?)
    end

    # All filesystems that could contain Linux system from the given disks
    #
    # Note that filesystems over LVM LVs are not included.
    #
    # @see #filesystems_collection
    #
    # @param disks [Array<BlkDevice, String>]
    # @return [Array<Filesystems::BlkFilesystem>]
    def linux_suitable_filesystems(*disks)
      filesystems_collection(*disks).select(&:root_suitable?)
    end

    # All filesystems that could contain a Linux system
    #
    # Note that {#linux_suitable_filesystems} does not take into account filesystems over a LVM LV.
    #
    # @return [Array<Filesystems::Base>]
    def all_linux_suitable_filesystems
      @all_linux_suitable_filesystems ||= devicegraph.filesystems.select(&:root_suitable?)
    end

    # Finds software RAIDs that are considered valid candidates for a Linux installation
    #
    # @see #candidate_software_raid?
    #
    # @return [Array<Md>]
    def candidate_software_raids
      devicegraph.software_raids.select { |md| available_device?(md) && supports_boot_partitions?(md) }
    end

    # Finds disk devices that are considered valid candidates
    #
    # Basically, all available disk devices except those that are part of a candidate software RAID.
    #
    # @return [Array<BlkDevice>]
    def candidate_disk_devices
      rejected_disk_devices = candidate_software_raids.map(&:ancestors).flatten
      candidate_disk_devices = devicegraph.disk_devices.select { |d| available_device?(d) }

      candidate_disk_devices - rejected_disk_devices
    end

    # Checks whether a device contains a mounted filesystem
    #
    # @see #device_filesystems, #mounted_filesystem?
    #
    # @param device [BlkDevice]
    # @return [Boolean]
    def contain_mounted_filesystem?(device)
      device_filesystems(device).any? { |f| mounted_filesystem?(f) }
    end

    # All filesystems inside a device
    #
    # The device could be directly formatted or the filesystem could belong to a partition inside the
    # device. Moreover, when the device (on any of its partitions) is used as LVM PV, all filesystem
    # inside the LVM VG are considered as belonging to the device.
    #
    # @param device [BlkDevice]
    # @return [Array<BlkFilesystem>]
    def device_filesystems(device)
      device.descendants.select { |d| d.is?(:blk_filesystem) }
    end

    # Checks whether a filesystem is currently mounted
    #
    # @param filesystem [Filesystems::Base]
    # @return [Boolean]
    def mounted_filesystem?(filesystem)
      filesystem.active_mount_point?
    end

    # Checks whether a device contains an installation repository
    #
    # A device contains an installation repository if the device or any of its descendant devices
    # is included in the list of devices from the installation repository URI. For example, if the
    # URI is "hd:/subdir?device=/dev/sda1", then "/dev/sda" contains an installation repository.
    #
    # @param device [BlkDevice]
    # @return [Boolean]
    def contain_installation_repository?(device)
      repositories_names = repositories_devices.map(&:name)

      all_devices_from_device(device).any? { |d| repositories_names.include?(d.name) }
    end

    # All blk devices defined from a device, including the given device
    # (e.g., a disk and all its partitions)
    #
    # Note that when a device contains a partition being used as LVM PV, all LVM LVs are included.
    #
    # @param device [BlkDevice]
    # @return [Array<BlkDevice>]
    def all_devices_from_device(device)
      devices = device.descendants.select { |d| d.is?(:blk_device) }
      devices.prepend(device)
    end

    # Devices whose name is indicated in the URI of the installation repositories
    #
    # @return [Array<BlkDevice>]
    def repositories_devices
      return @repositories_devices if @repositories_devices

      devices = repositories_device_names.map { |n| devicegraph.find_by_any_name(n) }.compact

      @repositories_devices = devices
    end

    # Device names indicated in the URI of the installation repositories
    #
    # @see #local_repositories
    #
    # @return [Array<String>]
    def repositories_device_names
      return @repositories_device_names if @repositories_device_names

      names = local_repositories.flat_map { |r| repository_device_names(r) }.uniq

      @repositories_device_names = names
    end

    # TODO: This method should be moved to Y2Packager::Repository class
    #
    # Device names indicated in the URI of an installation repository
    #
    # For example:
    #   "hd:/subdir?device=/dev/sda1&filesystem=reiserfs" => ["/dev/sda1"]
    #   "dvd:/?devices=/dev/sda,/dev/sdb" => ["/dev/sda", "/dev/sdb"]
    #
    # @param repository [Y2Packager::Repository]
    # @return [Array<String>]
    def repository_device_names(repository)
      match_data = repository.url.to_s.match(/.*devices?=([^&]*)/)
      return [] unless match_data

      match_data[1].split(",").map(&:strip)
    end

    # Local repositories used during installation
    #
    # @return [Array<Y2Packager::Repository>]
    def local_repositories
      Y2Packager::Repository.all.select(&:local?)
    end

    # Current architecture
    #
    # @return [Y2Storage::Arch]
    def arch
      @arch ||= StorageManager.instance.arch
    end
  end
end
