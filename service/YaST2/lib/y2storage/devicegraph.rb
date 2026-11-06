# Copyright (c) [2017-2023] SUSE LLC
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

require "pp"
require "tempfile"
require "y2storage/bcache"
require "y2storage/bcache_cset"
require "y2storage/blk_device"
require "y2storage/disk"
require "y2storage/device_finder"
require "y2storage/dump_manager"
require "y2storage/fake_device_factory"
require "y2storage/filesystems/base"
require "y2storage/filesystems/blk_filesystem"
require "y2storage/filesystems/tmpfs"
require "y2storage/filesystems/nfs"
require "y2storage/lvm_lv"
require "y2storage/lvm_vg"
require "y2storage/md"
require "y2storage/md_member"
require "y2storage/partition"
require "y2storage/storage_class_wrapper"
require "y2storage/storage_manager"
require "y2storage/storage_features_list"

module Y2Storage
  # The master container of libstorage.
  #
  # A Devicegraph object represents a state of the system regarding its storage
  # devices (both physical and logical). It can be the probed state (read from
  # the inspected system) or a possible target state.
  #
  # This is a wrapper for Storage::Devicegraph
  class Devicegraph # rubocop:disable Metrics/ClassLength
    include Yast::Logger
    include StorageClassWrapper
    wrap_class Storage::Devicegraph

    storage_forward :==
    storage_forward :!=

    # @!method load(filename)
    #   Reads the devicegraph from a xml file (libstorage format)
    storage_forward :load

    # @!method save(filename)
    #   Writes the devicegraph to a xml file (libstorage format)
    storage_forward :save

    # @!write_graphviz(filename, graphviz_flags)
    #   Writes the devicegraph to a file in Graphviz format
    storage_forward :write_graphviz

    # @!method empty?
    #   Checks whether the devicegraph is empty (no devices)
    storage_forward :empty?

    # @!method clear
    #   Removes all devices
    storage_forward :clear

    # @!method check(callbacks)
    #
    #   Checks the devicegraph
    #
    #   There are two types of errors that can be found:
    #
    #   * Errors that indicate a problem inside the library or a severe misuse of the library,
    #     e.g. attaching a BlkFilesystem directly to a PartitionTable. For these errors an exception is
    #     thrown.
    #
    #   * Errors that can be easily fixed by the user, e.g. an over-committed volume group. For these
    #     errors CheckCallbacks::error() is called.
    #
    #   @param callbacks [Storage::CheckCallbacks]
    #   @raise [Exception]
    storage_forward :storage_check, to: :check
    private :storage_check

    # @!method storage_used_features(dependency_type)
    #   @param dependency_type [Integer] value of Storage::UsedFeaturesDependencyType
    #   @return [Integer] bit-field with the used features of the devicegraph
    storage_forward :storage_used_features, to: :used_features
    private :storage_used_features

    # @!method storage_copy(dest)
    #   Copies content to another devicegraph
    #
    #   @param dest [Devicegraph] destination devicegraph
    storage_forward :storage_copy, to: :copy
    private :storage_copy

    # @!method find_device(device)
    #   Find a device by its {Device#sid sid}
    #
    #   @param device [Integer] sid of device
    #   @return [Device]
    storage_forward :find_device, as: "Device"

    # @!method remove_device(device)
    #
    # Removes a device from the devicegraph. Only use this
    # method if there is no special method to delete a device,
    # e.g., PartitionTable.delete_partition() or LvmVg.delete_lvm_lv().
    #
    # @see #remove_md
    # @see #remove_lvm_vg
    # @see #remove_btrfs_subvolume
    #
    # @param device [Device, Integer] a device or its {Device#sid sid}
    #
    # @raise [DeviceNotFoundBySid] if a device with given sid is not found
    storage_forward :remove_device
    private :remove_device

    # @return [IssuesList] List of probing issues
    attr_accessor :probing_issues

    # Creates a new devicegraph with the information read from a file
    #
    # @param filename [String]
    # @return [Devicegraph]
    def self.new_from_file(filename)
      storage = Y2Storage::StorageManager.instance.storage
      devicegraph = ::Storage::Devicegraph.new(storage)
      Y2Storage::FakeDeviceFactory.load_yaml_file(devicegraph, filename)
      new(devicegraph)
    end

    # @return [Devicegraph]
    def dup
      new_graph = ::Storage::Devicegraph.new(to_storage_value.storage)
      copy(Devicegraph.new(new_graph))
    end
    alias_method :duplicate, :dup

    # Copies the devicegraph into another one, but avoiding to copy into itself
    #
    # @return [Boolean] true if the devicegraph was copied; false otherwise.
    def safe_copy(devicegraph)
      # Never try to copy into itself. Bug#1069671
      return false if devicegraph.equal?(self)

      copy(devicegraph)
      true
    end

    # Copies the devicegraph into another one
    #
    # @param devicegraph [Devicegraph]
    def copy(devicegraph)
      storage_copy(devicegraph)
      devicegraph.probing_issues = probing_issues
      devicegraph
    end

    # Checks the devicegraph and logs the errors
    #
    # Note that the errors reported as exception are logged too.
    def check
      log.info("devicegraph checks:")
      storage_check(Callbacks::Check.new)
    rescue Storage::Exception => e
      log.error(e.what.force_encoding("UTF-8"))
    end

    # Set of actions needed to get this devicegraph
    #
    # By default the starting point is the probed devicegraph
    #
    # @param from [Devicegraph] starting graph to calculate the actions
    #       If nil, the probed devicegraph is used.
    # @return [Actiongraph]
    def actiongraph(from: nil)
      storage_object = to_storage_value.storage || StorageManager.instance.storage
      origin = from ? from.to_storage_value : storage_object.probed
      graph = ::Storage::Actiongraph.new(storage_object, origin, to_storage_value)
      Actiongraph.new(graph)
    end

    # All the devices in the devicegraph, in no particular order
    #
    # @return [Array<Device>]
    def devices
      Device.all(self)
    end

    # All the DASDs in the devicegraph, sorted by name
    #
    # @note Based on the libstorage classes hierarchy, DASDs are not considered to be disks.
    # See #disk_devices for a method providing the whole list of both disks and DASDs.
    # @see #disk_devices
    #
    # @return [Array<Dasd>]
    def dasds
      Dasd.sorted_by_name(self)
    end

    # All the disks in the devicegraph, sorted by name
    #
    # @note Based on the libstorage classes hierarchy, DASDs are not considered to be disks.
    # See #disk_devices for a method providing the whole list of both disks and DASDs.
    # @see #disk_devices
    #
    # @return [Array<Disk>]
    def disks
      Disk.sorted_by_name(self)
    end

    # All the stray block devices (basically XEN virtual partitions) in the
    # devicegraph, sorted by name
    #
    # @return [Array<StrayBlkDevice>]
    def stray_blk_devices
      StrayBlkDevice.sorted_by_name(self)
    end

    # All the multipath devices in the devicegraph, sorted by name
    #
    # @return [Array<Multipath>]
    def multipaths
      Multipath.sorted_by_name(self)
    end

    # All the DM RAIDs in the devicegraph, sorted by name
    #
    # @return [Array<DmRaid>]
    def dm_raids
      DmRaid.sorted_by_name(self)
    end

    # All the MD RAIDs in the devicegraph, sorted by name
    #
    # @return [Array<Md>]
    def md_raids
      Md.sorted_by_name(self)
    end

    # All MD BIOS RAIDs in the devicegraph, sorted by name
    #
    # @note The class MdMember is used by libstorage-ng to represent MD BIOS RAIDs.
    #
    # @return [Array<MdMember>]
    def md_member_raids
      MdMember.sorted_by_name(self)
    end

    # All RAIDs in the devicegraph, sorted by name
    #
    # @return [Array<Md, MdMember, DmRaid>]
    def raids
      BlkDevice.sorted_by_name(self).select { |d| d.is?(:raid) }
    end

    # All BIOS RAIDs in the devicegraph, sorted by name
    #
    # @note BIOS RAIDs are the set composed by MD BIOS RAIDs and DM RAIDs.
    #
    # @return [Array<DmRaid, MdMember>]
    def bios_raids
      BlkDevice.sorted_by_name(self).select { |d| d.is?(:bios_raid) }
    end

    # All Software RAIDs in the devicegraph, sorted by name
    #
    # @note Software RAIDs are all Md devices except MdMember and MdContainer devices.
    #
    # @return [Array<Md>]
    def software_raids
      BlkDevice.sorted_by_name(self).select { |d| d.is?(:software_raid) }
    end

    # All the devices that are usually treated like disks by YaST, sorted by
    # name
    #
    # Currently this method returns an array including all the multipath
    # devices and BIOS RAIDs, as well as disks and DASDs that are not part
    # of any of the former.
    # @see #disks
    # @see #dasds
    # @see #multipaths
    # @see #bios_raids
    #
    # @return [Array<Dasd, Disk, Multipath, DmRaid, MdMember>]
    def disk_devices
      BlkDevice.sorted_by_name(self).select { |d| d.is?(:disk_device) }
    end

    # All partitions in the devicegraph, sorted by name
    #
    # @return [Array<Partition>]
    def partitions
      Partition.sorted_by_name(self)
    end

    # @return [Array<Filesystems::Base>]
    def filesystems
      Filesystems::Base.all(self)
    end

    # All mount points in the devicegraph, in no particular order
    #
    # @return [Array<MountPoint>]
    def mount_points
      MountPoint.all(self)
    end

    # @param mountpoint [String] mountpoint of the filesystem (e.g. "/").
    # @return [Boolean]
    def filesystem_in_network?(mountpoint)
      filesystem = filesystems.find { |i| i.mount_path == mountpoint }
      return false if filesystem.nil?

      filesystem.in_network?
    end

    # @return [Array<Filesystems::BlkFilesystem>]
    def blk_filesystems
      Filesystems::BlkFilesystem.all(self)
    end

    # @return [Array<Filesystems::Btrfs>]
    def btrfs_filesystems
      blk_filesystems.select { |f| f.is?(:btrfs) }
    end

    # All multi-device Btrfs filesystems
    #
    # @return [Array<Filesystems::BlkFilesystem::Btrfs>]
    def multidevice_btrfs_filesystems
      btrfs_filesystems.select(&:multidevice?)
    end

    # @return [Array<Filesystem::Tmpfs>]
    def tmp_filesystems
      Filesystems::Tmpfs.all(self)
    end

    # @return [Array<Filesystem::Nfs>]
    def nfs_mounts
      Filesystems::Nfs.all(self)
    end

    # @return [Array<Bcache>]
    def bcaches
      Bcache.all(self)
    end

    # @return [Array<BcacheCset>]
    def bcache_csets
      BcacheCset.all(self)
    end

    # All the LVM volume groups in the devicegraph, sorted by name
    #
    # @return [Array<LvmVg>]
    def lvm_vgs
      LvmVg.sorted_by_name(self)
    end

    # @return [Array<LvmPv>]
    def lvm_pvs
      LvmPv.all(self)
    end

    # All the LVM logical volumes in the devicegraph, sorted by name
    #
    # @return [Array<LvmLv>]
    def lvm_lvs
      LvmLv.sorted_by_name(self)
    end

    # All the block devices in the devicegraph, sorted by name
    #
    # @return [Array<BlkDevice>]
    def blk_devices
      BlkDevice.sorted_by_name(self)
    end

    # All Encryption devices in the devicegraph, sorted by name
    #
    # @return [Array<Encryption>]
    def encryptions
      Encryption.sorted_by_name(self)
    end

    # Find device with given name e.g. /dev/sda3
    #
    # In case of LUKSes and MDs, the device might be found by using an alternative name,
    # see {DeviceFinder#alternative_names}.
    #
    # @param name [String]
    # @param alternative_names [Boolean] whether to try the search with possible alternative names
    # @return [Device, nil] if found Device and if not, then nil
    def find_by_name(name, alternative_names: true)
      DeviceFinder.new(self).find_by_name(name, alternative_names)
    end

    # Finds a device by any name including any symbolic link in the /dev directory
    #
    # This is different from {BlkDevice.find_by_any_name} in several ways. See
    # {DeviceFinder#find_by_any_name} for details.
    #
    # In case of LUKSes and MDs, the device might be found by using an alternative name,
    # see {DeviceFinder#alternative_names}.
    #
    # @param device_name [String] can be a kernel name like "/dev/sda1" or any symbolic
    #   link below the /dev directory
    # @param alternative_names [Boolean] whether to try the search with possible alternative names
    # @return [Device, nil] the found device, nil if no device matches the name
    def find_by_any_name(device_name, alternative_names: true)
      DeviceFinder.new(self).find_by_any_name(device_name, alternative_names)
    end

    # @return [Array<FreeDiskSpace>]
    def free_spaces
      disk_devices.reduce([]) { |sum, disk| sum + disk.free_spaces }
    end

    # Removes a bcache and all its descendants
    #
    # It also removes bcache_cset if it is not used by any other bcache device.
    #
    # @see #remove_with_dependants
    #
    # @param bcache [Bcache]
    #
    # @raise [ArgumentError] if the bcache does not exist in the devicegraph
    def remove_bcache(bcache)
      raise(ArgumentError, "Incorrect device #{bcache.inspect}") unless bcache&.is?(:bcache)

      bcache_cset = bcache.bcache_cset
      remove_with_dependants(bcache)
      # FIXME: Actually we want to automatically remove the cset?
      remove_with_dependants(bcache_cset) if bcache_cset&.bcaches&.empty?
    end

    # Removes a caching set
    #
    # Bcache devices using this caching set are not removed.
    #
    # @raise [ArgumentError] if the caching set does not exist in the devicegraph
    def remove_bcache_cset(bcache_cset)
      if !(bcache_cset && bcache_cset.is?(:bcache_cset))
        raise(ArgumentError, "Incorrect device #{bcache_cset.inspect}")
      end

      remove_device(bcache_cset)
    end

    # Removes a Md raid and all its descendants
    #
    # It also removes other devices that may have become useless, like the
    # LvmPv devices of any removed LVM volume group.
    #
    # @see #remove_lvm_vg
    #
    # @param md [Md]
    #
    # @raise [ArgumentError] if the md does not exist in the devicegraph
    def remove_md(md)
      raise(ArgumentError, "Incorrect device #{md.inspect}") unless md&.is?(:md)

      remove_with_dependants(md)
    end

    # Removes an LVM VG, all its descendants and the associated PV devices
    #
    # Note this removes the LvmPv devices, not the real block devices hosting
    # those physical volumes.
    #
    # @param vg [LvmVg]
    #
    # @raise [ArgumentError] if the volume group does not exist in the devicegraph
    def remove_lvm_vg(vg)
      raise(ArgumentError, "Incorrect device #{vg.inspect}") unless vg&.is?(:lvm_vg)

      remove_with_dependants(vg)
    end

    # Removes a Btrfs subvolume and all its descendants
    #
    # @param subvol [BtrfsSubvolume]
    #
    # @raise [ArgumentError] if the subvolume does not exist in the devicegraph
    def remove_btrfs_subvolume(subvol)
      if subvol.nil? || !subvol.is?(:btrfs_subvolume)
        raise ArgumentError, "Incorrect device #{subvol.inspect}"
      end

      remove_with_dependants(subvol)
    end

    # Removes an NFS mount and all its descendants
    #
    # @param nfs [Filesystems::Nfs]
    #
    # @raise [ArgumentError] if the NFS filesystem does not exist in the devicegraph
    def remove_nfs(nfs)
      raise(ArgumentError, "Incorrect device #{nfs.inspect}") unless nfs&.is?(:nfs)

      remove_with_dependants(nfs)
    end

    # Removes a Tmpfs filesystem and all its descendants
    #
    # @param tmpfs [Filesystems::Tmpfs]
    #
    # @raise [ArgumentError] if the Tmpfs filesystem does not exist in the devicegraph
    def remove_tmpfs(tmpfs)
      raise(ArgumentError, "Incorrect device #{tmpfs.inspect}") unless tmpfs&.is?(:tmpfs)

      remove_with_dependants(tmpfs)
    end

    # String to represent the whole devicegraph, useful for comparison in
    # the tests.
    #
    # The format is deterministic (always equal for equivalent devicegraphs)
    # and based in the structure generated by YamlWriter
    # @see Y2Storage::YamlWriter
    #
    # @note As described, this method is intended to be used for comparison
    # purposes in the tests. It should not be used as a general mechanism for
    # logging since it can leak internal information like passwords.
    #
    # @return [String]
    def to_str
      PP.pp(recursive_to_a(device_tree(record_passwords: true)), "")
    end

    # @return [String]
    def inspect
      "#<Y2Storage::Devicegraph device_tree=#{recursive_to_a(device_tree)}>"
    end

    # Generates a string representation of the devicegraph in xml format
    #
    # @note The library offers a #save method to obtain the devicegraph in xml
    #   format, but it requires a file path where to dump the result. For this
    #   reason a temporary file is used here, but it would not be necessary if
    #   the library directly returns the xml string without save it into a file.
    #
    # @return [String]
    def to_xml
      file = Tempfile.new("devicegraph.xml")
      save(file.path)
      file.read
    ensure
      # Do not wait for garbage collector and delete the file right away
      file.close
      file.unlink
    end

    # Dump the devicegraph to both XML and YAML.
    #
    # @param file_base_name [String] File base name to use.
    #   Leave this empty to use a generated name ("01-staging-01",
    #   "02-staging", ...).
    def dump(file_base_name = nil)
      DumpManager.dump(self, file_base_name)
    end

    # Executes the pre_commit method in all the devices
    def pre_commit
      devices_action(:pre_commit)
    end

    # Executes the post_commit method in all the devices
    def post_commit
      devices_action(:post_commit)
    end

    # Executes the finish_installation method in all the devices
    def finish_installation
      devices_action(:finish_installation)
    end

    # List of storage features used by the devicegraph
    #
    # Note this is used during system installation. In the installed system, the
    # combination of Actiongraph#used_features and Devicegraph#yast_commit_features
    # is used instead.
    #
    # By default, it returns the features associated to all devices and filesystems
    # in the devicegraph. The required_only argument can be used to limit the result
    # by excluding features that are not mandatory to produce a functional system. For
    # example, it excludes features associated to those filesystems that have no mount
    # point.
    #
    # @param required_only [Boolean] whether the result should only include those
    #   features that are mandatory (ie. associated to devices with a mount point or
    #   to devices that will be configured during the first boot of the new system)
    # @return [StorageFeaturesList]
    def used_features(required_only: false)
      type =
        if required_only
          Storage::UsedFeaturesDependencyType_REQUIRED
        else
          Storage::UsedFeaturesDependencyType_SUGGESTED
        end

      list = StorageFeaturesList.from_bitfield(storage_used_features(type))
      list.concat(yast_commit_features)
      list
    end

    # List of required (mandatory) storage features used by the devicegraph
    #
    # @return [StorageFeaturesList]
    def required_used_features
      used_features(required_only: true)
    end

    # List of optional storage features used by the devicegraph
    #
    # @return [StorageFeaturesList]
    def optional_used_features
      all = storage_used_features(Storage::UsedFeaturesDependencyType_SUGGESTED)
      required = storage_used_features(Storage::UsedFeaturesDependencyType_REQUIRED)
      # Using binary XOR in those bit fields to calculate the difference
      list = StorageFeaturesList.from_bitfield(all ^ required)
      list.concat(yast_commit_features)
      list
    end

    # List of features that correspond to aspects handled by Y2Storage (not coming
    # from libstorage-ng) and that need to be present in the target system either during
    # the storage commit phase or at a later stage. Ie. features needed in the target
    # system to access the device or to finish its configuration.
    #
    # @return [StorageFeaturesList]
    def yast_commit_features
      features = encryptions.flat_map(&:commit_features).uniq
      StorageFeaturesList.new(features)
    end

    private

    # Copy of a device tree where hashes have been substituted by sorted
    # arrays to ensure consistency
    #
    # @see YamlWriter#yaml_device_tree
    def recursive_to_a(tree)
      case tree
      when Array
        tree.map { |element| recursive_to_a(element) }
      when Hash
        tree.map { |key, value| [key, recursive_to_a(value)] }.sort_by(&:first)
      else
        tree
      end
    end

    def device_tree(record_passwords: false)
      writer = Y2Storage::YamlWriter.new
      writer.record_passwords = record_passwords
      writer.yaml_device_tree(self)
    end

    # Removes a device, all its descendants and also the potential orphans of
    # all the removed devices.
    #
    # @see Device#potential_orphans
    #
    # @param device [Device]
    # @param keep [Array<Device>] used to control the recursive calls
    #
    # @raise [ArgumentError] if the device does not exist in the devicegraph
    def remove_with_dependants(device, keep: [])
      raise(ArgumentError, "No device provided") if device.nil?
      raise(ArgumentError, "Device not found") unless device.exists_in_devicegraph?(self)

      children = device.children(View::REMOVE)
      until children.empty?
        remove_with_dependants(children.first, keep: keep + [device])
        children = device.children(View::REMOVE)
      end

      orphans = device.respond_to?(:potential_orphans) ? device.potential_orphans : []
      remove_device(device)

      orphans.each do |dev|
        next if keep.include?(dev)

        dev.remove_descendants
        remove_device(dev)
      end
    end

    # See {#pre_commit} and {#post_commit}
    def devices_action(method)
      devices.each do |device|
        device.send(method) if device.respond_to?(method)
      end
    end
  end
end
