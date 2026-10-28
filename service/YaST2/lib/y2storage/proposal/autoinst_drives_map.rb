# Copyright (c) [2017-2019] SUSE LLC
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

require "y2storage/exceptions"

module Y2Storage
  module Proposal
    # Utility class to map disk names to the <drive> section of the AutoYaST
    # profile that will be applied to that disk.
    #
    # @see AutoinstProfile::PartitioningSection
    # @see AutoinstProfile::DriveSection
    class AutoinstDrivesMap
      extend Forwardable

      # @!method each_pair
      #   Calls block once per each disk that contains the AutoYaST specification
      #   passing as arguments the disk name and the corresponding
      #   AutoinstProfile::DriveSection object.
      #
      #   @example
      #     drives_map.each_pair do |disk_name, drive_section|
      #       puts "Drive for #{disk_name}: #{drive_section}"
      #     end
      #
      # @!method each
      #   @see #each_pair
      def_delegators :@drives, :each, :each_pair

      # @return [AutoinstIssues::List] List of found AutoYaST issues
      attr_reader :issues_list

      # Constructor
      #
      # @param devicegraph  [Devicegraph] Devicegraph where the disks are contained
      # @param partitioning [AutoinstProfile::PartitioningSection] Partitioning layout
      #   from an AutoYaST profile
      # @param issues_list [AutoinstIssues::List] List of AutoYaST issues to register them
      def initialize(devicegraph, partitioning, issues_list)
        @drives = {}
        @issues_list = issues_list

        add_disks(partitioning.disk_drives, devicegraph)
        add_vgs(partitioning.lvm_drives)
        add_mds(partitioning.md_drives)
        add_bcaches(partitioning.bcache_drives)
        add_btrfs_filesystems(partitioning.btrfs_drives)
        add_tmpfs_filesystems(partitioning.tmpfs_drives)
        add_nfs_filesystems(partitioning.nfs_drives)
      end

      # Returns the list of disk names
      #
      # @return [Array<String>] Disk names
      def disk_names
        @drives.keys
      end

      # Returns whether the map contains partitions
      #
      # @example Containing partitions
      #   devicegraph = Y2Storage::StorageManager.instance.probed
      #   array = [
      #     {
      #       "device" => "/dev/sda", "use" => "all", "partitions" => [
      #         { "mount" => "/" }
      #       ]
      #     }
      #   ]
      #   profile = AutoinstProfile::PartitioningSection.new_from_hashes(array)
      #   map = AutoinstDriveMap.new(devicegraph, profile)
      #   map.partitions? # => true
      #
      # @example Not containing partitions
      #   devicegraph = Y2Storage::StorageManager.instance.probed
      #   array = [{ "device" => "/dev/sda", "use" => "all" }]
      #   profile = AutoinstProfile::PartitioningSection.new_from_hashes(array)
      #   map = AutoinstDriveMap.new(devicegraph, profile)
      #   map.partitions? # => false
      def partitions?
        @drives.values.any? { |i| !i.partitions.empty? }
      end

      # Determine whether any of the drives sets snapshots enabled
      #
      # @return [Boolean]
      def use_snapshots?
        @drives.empty? || @drives.values.any? do |drive|
          drive.enable_snapshots.nil? || drive.enable_snapshots
        end
      end

      protected

      # Find the first usable disk for the given <drive> AutoYaST specification
      #
      # @note Stray block devices and partitions with no parents (like Xen partitions)
      #   are also considered.
      #
      # @param drive  [AutoinstProfile::DriveSection] AutoYaST drive specification
      # @param devicegraph [Devicegraph] Devicegraph
      # @return [Disk,nil] Usable disk or nil if none is found
      def first_usable_disk(drive, devicegraph)
        skip_list = drive.skip_list

        devices = devicegraph.blk_devices.select do |dev|
          dev.is?(:disk_device, :stray_blk_device)
        end

        devices.each do |disk|
          next if disk_names.include?(disk.name)
          next if skip_list.matches?(disk)

          return disk
        end
        nil
      end

      # Adds disks to the devices map
      #
      # If some disk does not specify a "device" property, an usable disk will
      # be chosen from the given devicegraph.
      #
      # @param disks [Array<AutoinstProfile::DriveSection>] List of disk specifications from AutoYaST
      # @param devicegraph [Devicegraph] Devicegraph to search for disks for "flexible" devices
      def add_disks(disks, devicegraph)
        fixed_drives, flexible_drives = disks.partition(&:device)
        fixed_drives.each do |drive|
          disk = find_disk(devicegraph, drive.device)

          if disk
            @drives[disk.name] = drive
          elsif stray_devices_group?(drive, devicegraph)
            @drives[drive.device] = drive
          else
            issues_list.add(Y2Storage::AutoinstIssues::NoDisk, drive)
          end
        end

        flexible_drives.each do |drive|
          disk = first_usable_disk(drive, devicegraph)

          if disk.nil?
            issues_list.add(Y2Storage::AutoinstIssues::NoDisk, drive)
            next
          end

          @drives[disk.name] = drive
        end
      end

      # Adds volume groups to the devices map
      #
      # All volume groups should have a "device" property.
      #
      # @param vgs [Array<AutoinstProfile::DriveSection>] List of LVM VG specifications from AutoYaST
      def add_vgs(vgs)
        vgs.each { |v| @drives[v.device] = v }
      end

      # Adds MD arrays to the devices map
      #
      # @see AutoinstProfile::DriveSection#name_for_md for details about the
      #   logic used to infer the device name.
      #
      # @param mds [Array<AutoinstProfile::DriveSection>] List of MD RAID specifications from AutoYaST
      def add_mds(mds)
        mds.each do |md|
          @drives[md.name_for_md] = md
        end
      end

      # Adds bcaches to the device map
      #
      # All bcaches should have a "device" property.
      #
      # @param bcaches [Array<AutoinstProfile::DriveSection>] List of bcaches specifications from
      #   AutoYaST
      def add_bcaches(bcaches)
        bcaches.each { |b| @drives[b.device] = b }
      end

      # Adds Btrfs filesystems to the device map
      #
      # @param btrfs_drives [Array<AutoinstProfile::DriveSection>] List of Btrfs specifications from
      #   AutoYaST
      def add_btrfs_filesystems(btrfs_drives)
        btrfs_drives.each { |d| @drives[d.device] = d }
      end

      # Adds Tmpfs filesystems to the device map
      #
      # @param tmpfs_drives [Array<AutoinstProfile::DriveSection>] List of Tmpfs specifications from
      #   AutoYaST
      def add_tmpfs_filesystems(tmpfs_drives)
        tmpfs_drives.each_with_index { |d, i| @drives["tmpfs-#{i}"] = d }
      end

      # Adds NFS filesystems to the device map
      #
      # All NFS filesystems should have a "device" property.
      #
      # @param nfs_drives [Array<AutoinstProfile::DriveSection>] List of NFS specifications from
      #   AutoYaST
      def add_nfs_filesystems(nfs_drives)
        nfs_drives.each { |d| @drives[d.device] = d }
      end

      # Finds a disk using any possible name
      #
      # @see Y2Storage::Devicegraph#find_by_any_name
      #
      # @param devicegraph [Devicegraph]
      # @param device_name [String] e.g., "/dev/sda"
      #
      # @return [Disk, nil] Usable disk or nil if none is found
      def find_disk(devicegraph, device_name)
        device = devicegraph.find_by_any_name(device_name)
        return nil unless device

        mp_device = device.multipath
        return mp_device if mp_device

        ([device] + device.ancestors).find { |d| d.is?(:disk_device, :stray_blk_device) }
      end

      # Whether the given <drive> section represents a set of Xen virtual
      # partitions
      #
      # FIXME: this is a very simplistic approach implemented as bugfix for
      # bsc#1085134. A <drive> section is only considered to represent a set of
      # virtual partitions if ALL its partitions contain an explicit
      # partition_nr that matches with the name of a stray block device. If any
      # of the <partition> subsections does not include partition_nr or does not
      # match with an existing device, the whole drive is discarded.
      #
      # NOTE: in the future the AutoYaST profile will hopefully allow a more
      # flexible usage of disks. Then Xen virtual partitions could be
      # represented as disks in the profile (which matches reality way better),
      # and there will be no need to improve this method much further.
      #
      # See below for an example of an AutoYaST profile for a system with
      # the virtual partitions /dev/xvda1, /dev/xvda2 and /dev/xvdb1. That
      # example includes two devices /dev/xvda and /dev/xvdb that really do
      # not exist in the system.
      #
      # So this method checks if the given <drive> section contains a set of
      # <partition> subsections that correspond to existing Xen virtual
      # partitions (stray block devices) in the system.
      #
      # @example AutoYaST profile for Xen virtual partitions
      #   <drive>
      #     <device>/dev/xvda</device>
      #     <partition>
      #       <partition_nr>1</partition_nr>
      #       ...information about /dev/xvda1...
      #     </partition>
      #     <partition>
      #       <partition_nr>2</partition_nr>
      #       ...information about /dev/xvda2...
      #     </partition>
      #   </drive>
      #
      #   <drive>
      #     <device>/dev/xvdb</device>
      #     <partition>
      #       <partition_nr>1</partition_nr>
      #       ...information about /dev/xvdb1...
      #     </partition>
      #   </drive>
      #
      # @param drive  [AutoinstProfile::DriveSection] AutoYaST drive specification
      # @param devicegraph [Devicegraph] Devicegraph
      # @return [Boolean] false if there are no partition sections or they do
      #   not correspond to stray devices
      def stray_devices_group?(drive, devicegraph)
        return false if drive.partitions.empty?

        devices = devicegraph.stray_blk_devices
        drive.partitions.all? do |partition|
          next false if partition.partition_nr.nil?

          name = drive.device + partition.partition_nr.to_s
          devices.any? { |dev| dev.name == name }
        end
      end
    end
  end
end
