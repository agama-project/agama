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

require "yast"
require "yaml"
require "y2storage/storage_class_wrapper"
require "y2storage/storage_env"
require "y2storage/resize_info"

module Y2Storage
  # An abstract base class of storage devices and a vertex in the Devicegraph.
  #
  # The Device class does not have a device name since some device types do
  # not have a intrinsic device name, e.g. btrfs.
  #
  # This is a wrapper for Storage::Device.
  class Device
    include Yast::Logger
    include StorageClassWrapper

    wrap_class Storage::Device,
      downcast_to: ["BlkDevice", "BcacheCset", "Mountable", "MountPoint", "PartitionTables::Base",
                    "LvmPv", "LvmVg", "BtrfsQgroup"]

    storage_forward :storage_eql, to: :==
    protected :storage_eql

    #  compare two devices.
    #  @note devices are equal if they have the same {#sid storage id}.
    #  @see sid
    #
    #  @param other [Device]
    #  @return [Boolean] false if compared to different class
    def ==(other)
      return false if self.class != other.class

      storage_eql(other)
    end

    #  compare two devices.
    #  @see ==
    #
    #  @param other [Device]
    #  @return [Boolean] true if compared to different class
    def !=(other)
      !(self == other) # rubocop:disable Style/InverseMethods:
    end

    alias_method :eql?, :==

    # redefine hash method to return same result for same devices independently
    # found. It is needed e.g. for array subtraction in ruby2.5
    # see (bsc#1076766)
    def hash
      sid.hash
    end

    # @!method sid
    #   @note This value is unique by device.
    #
    #   @return [Integer] internal storage id.
    storage_forward :sid

    # @see ancestors
    storage_forward :storage_ancestors, to: :ancestors, as: "Device"
    protected :storage_ancestors

    # @see descendants
    storage_forward :storage_descendants, to: :descendants, as: "Device"
    protected :storage_descendants

    # @see siblings
    storage_forward :storage_siblings, to: :siblings, as: "Device"
    protected :storage_siblings

    # @!method parents
    #   Parents in the devicegraph in no particular order.
    #   @return [Array<Device>]
    storage_forward :parents, as: "Device"

    # @!method children
    #   Children in the devicegraph in no particular order.
    #   @return [Array<Device>]
    storage_forward :children, as: "Device"

    # @!method has_children?
    #   Check whether the device has children in the devicegraph
    #   it belongs to.
    #
    #   @return [Boolean]
    storage_forward :has_children?, to: :has_children

    # @!method num_children
    #   Number of children the device has in the devicegraph
    #   it belongs to.
    #
    #   @return [Integer]
    storage_forward :num_children

    # @!method exists_in_devicegraph?(devicegraph)
    #   Check whether a devicegraph contains a device with the same
    #   {#sid storage id}.
    #   @see sid
    #
    #   @param devicegraph [Devicegraph]
    #   @return [Boolean]
    storage_forward :exists_in_devicegraph?

    # @!method exists_in_raw_probed?
    #   Check whether the device exists in the raw probed devicegraph
    #
    #   @note From storage-ng point of view, probed devicegraph is a
    #     sanitized version of the devicegraph probed by libstorage-ng.
    #
    #   @see StorageManager#raw_probed
    #   @see exists_in_devicegraph?
    #
    #   @return [Boolean]
    storage_forward :exists_in_raw_probed?, to: :exists_in_probed?

    # @!method exists_in_staging?
    #   Check whether the device exists in the staging devicegraph.
    #   @see exists_in_devicegraph?
    #
    #   @return [Boolean]
    storage_forward :exists_in_staging?

    storage_forward :storage_detect_resize_info, to: :detect_resize_info, as: "ResizeInfo"
    private :storage_detect_resize_info

    storage_forward :storage_remove_descendants, to: :remove_descendants
    private :storage_remove_descendants

    # @!attribute userdata
    #   Collection of free-form text fields to be stored in the devicegraph
    #   alongside the device. Useful for users of the library to add their own
    #   status information.
    #
    #   @return [Storage::MapStringString]
    storage_forward :userdata
    storage_forward :userdata=
    protected :userdata, :userdata=

    # @!method devicegraph
    #   Devicegraph to which the device is associated
    #
    #   @return [Devicegraph]
    storage_forward :devicegraph, as: "Devicegraph"

    # @!method self.compare_by_name(lhs, rhs)
    #   Compare two devices by their name, used for sorting sets of
    #   block devices and/or LVM VGs.
    #
    #   Using this method to compare and sort would result is something similar
    #   to alphabetical order but with some desired exceptions like:
    #
    #   * /dev/sda, /dev/sdb, ..., /dev/sdaa
    #   * /dev/md1, /dev/md2, ..., /dev/md10
    #
    #   @raise [Storage::Exception] if trying to compare something that is not
    #   {BlkDevice} or {LvmVg}
    #
    #   @param lhs [BlkDevice, LvmVg]
    #   @param rhs [BlkDevice, LvmVg]
    #   @return [boolean] true if the first argument should appear first in a
    #       sorted list (less than)
    storage_class_forward :compare_by_name

    # @!method name_sort_key
    #   Return a sort key based of the device name.
    #
    #   @return [string] a sort key for the device name or empty string
    storage_forward :name_sort_key

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<Device>] all the devices in the given devicegraph
    storage_class_forward :all, as: "Device"

    # Check whether the device exists in the probed devicegraph
    #
    # @note This is slightly different from Storage::Device#exists_in_probed?, which
    #   checks using the raw probed devicegraph.
    #
    # @see StorageManager#raw_probed
    # @see exists_in_raw_probed?
    # @see exists_in_devicegraph?
    #
    # @return [Boolean]
    def exists_in_probed?
      exists_in_devicegraph?(StorageManager.instance.probed)
    end

    # Ancestors in the devicegraph in no particular order, not including the
    # device itself.
    #
    # @note This is slightly different from Storage::Device#ancestors, which
    #   requires an argument to decide if the device itself should be included in
    #   the result.
    #
    # @return [Array<Device>]
    def ancestors
      itself = false
      storage_ancestors(itself)
    end

    # Descendants in the devicegraph in no particular order, not including the
    # device itself.
    #
    # @note This is slightly different from Storage::Device#descendants, which
    #   requires an argument to decide if the device itself should be included in
    #   the result.
    #
    # @param view [View] filter used to determine the descendants
    # @return [Array<Device>]
    def descendants(view = View::CLASSIC)
      itself = false
      storage_descendants(itself, view)
    end

    # Siblings in the devicegraph in no particular order, not including the
    # device itself.
    #
    # @note This is slightly different from Storage::Device#siblings, which
    #   requires an argument to decide if the device itself should be included in
    #   the result.
    #
    # @return [Array<Device>]
    def siblings
      itself = false
      storage_siblings(itself)
    end

    # Devices that are NOT descendants of this one but that would become
    # useless if this device is deleted.
    #
    # Used to identify potential leftovers for those devices that don't have a
    # explicit method in libstorage-ng to remove them and whose associated
    # devices would be overlooked by {#remove_descendants}, like the physical
    # volumes of a volume group.
    #
    # @return [Array<Device>]
    def potential_orphans
      []
    end

    # Copies the device to a given devicegraph, connecting it to its corresponding parents
    #
    # @note This method is intended to be used only for special cases. Use it with care, and make sure
    #   there is no another way to accomplish the same result.
    #
    # @raise [Storage::Exception] when there is an error copying the device (e.g., a parent is missing).
    #
    # @return [Y2Storage::Device] device copied to the given devicegraph
    def copy_to(devicegraph)
      if !exists_in_devicegraph?(devicegraph)
        storage_device = to_storage_value
        storage_devicegraph = devicegraph.to_storage_value

        storage_device.copy_to_devicegraph(storage_devicegraph)
        storage_device.in_holders.each { |h| h.copy_to_devicegraph(storage_devicegraph) }
      end

      devicegraph.find_device(sid)
    end

    # Information about the possibility of resizing a given device.
    # If the device has any children, they are also taken into account;
    # the result of this method is the combined information about this device
    # and all its children.
    #
    # Note that the minimal and maximal are not aligned.
    #
    # If the device already exists on the disk (i.e., in the probed
    # devicegraph), this operation can be expensive. Thus, consider using
    # {#resize_info} or any other caching mechanism.
    #
    # If Y2Storage is running in test mode (configured with an ENV variable)
    # then the device is not checked and a fake result is returned.
    #
    # @raise [Storage::Exception] if something goes wrong during the detection
    #   (e.g. it fails to temporarily mount the corresponding filesystem)
    #
    # @see can_resize?
    #
    # @return [ResizeInfo]
    def detect_resize_info
      if StorageEnv.instance.test_mode?
        reasons = Storage::RB_FILESYSTEM_FULL | Storage::RB_MIN_MAX_ERROR
        Y2Storage::ResizeInfo.new(Storage::ResizeInfo.new(false, reasons))
      else
        storage_detect_resize_info
      end
    end

    # Information about the possibility of resizing a given device.
    #
    # This method relies on {#detect_resize_info}, caching the result for the
    # whole lifecycle of this object.
    #
    # Take into account that the lifecycle of a Y2Storage::Device object is
    # usually sorter than the one of its corresponding libstorage-ng C++ object.
    # Due to the nature of SWIG, every query to the devicegraph will return a
    # new Y2Storage::Device object. This is actually convenient in this case to
    # control the lifetime of the caching.
    #
    # @example Caching the #detect_resize_info result
    #
    #   partition1 = disk.partitions.first
    #
    #   partition1.resize_info  # This calls #detect_resize_info
    #   @same_part = partition1
    #   @same_part.resize_info # Don't call #detect_resize_info, use cached
    #
    #  disk.partitions.first.resize_info # This calls #detect_resize_info
    #    # because disk.partitions.first returns a new object representing
    #    # the same device than partition1 (but not the same object).
    #
    #  @see #detect_resize_info
    def resize_info
      @resize_info ||= begin
        log.info "Calling #detect_resize_info"
        detect_resize_info
      end
    end

    # Check if the device can be resized.
    #
    # If the device has any children, they are also taken into account;
    # the result of this method is the combined information about this device
    # and all its children.
    #
    # Since this calls detect_resize_info internally, it might be an expensive
    # operation. If the ResizeInfo from detect_resize_info is needed afterwards
    # anyway, consider using it directly and caching the value for later reuse.
    #
    # @return [Boolean] true if the device can be resized, false if not.
    def can_resize?
      resize_info.resize_ok?
    end

    # Checks whether the device is a concrete kind(s) of device.
    #
    # Always false for this base class, which represents an abstract device.
    # To be redefined by classes representing more concrete devices.
    #
    # The goal of this method is to provide a more convenient alternative to the
    # usage of Object#is_a? that doesn't rely on fully qualified class names and
    # that can be extended or customized by each device subclass. See examples.
    #
    # @example Checking if a device is a disk
    #
    #   encryption.blk_device.is?(:disk)
    #
    # @example Filtering disks and partitions
    #
    #   something.ancestors.select { |dev| dev.is?(:disk, "partition") }
    #
    # @param types [#to_sym] name (or names) of the device type, as defined in
    #   each subclass.
    # @return [Boolean]
    def is?(*types)
      (types.map(&:to_sym) & types_for_is).any?
    end

    # Whether there is (or there will be) an entry for this device in the
    # relevant /etc file, to make the device available during system boot.
    #
    # For most kind of devices, this method makes no sense and returns always
    # false. But some kinds of devices need to be listed in a configuration file
    # (/etc/crypttab for encryption devices, /etc/fstab for filesystems,
    # /etc/mdadm.conf for MD RAIDs, etc.) in order to be automatically
    # recognized by the system. In those cases, the corresponding Device subclass
    # will redefine this method to check the attribute corresponding to the
    # relevant configuration file.
    #
    # @return [Boolean]
    def in_etc?
      false
    end

    # Updates the relevant attributes that are relevant for {#in_etc?} and
    # triggers the corresponding mechanism in the parent objects so the changes
    # are propagated.
    #
    # This method is used to ensure the consistency of {#in_etc?} and should be
    # triggered by any operation that is expected to produce relevant changes
    # in that regard. At the moment of writing, it's triggered whenever a new
    # mount point is created or removed, to make sure all the filesystems of the
    # system are available on boot.
    def update_etc_status
      update_etc_attributes
      update_parents_etc_status
    end

    # Removes all devices that are descendants of this one in the devicegraph,
    # according to the specified (optional) view
    #
    # The view should likely always be REMOVE, since it's the only one that
    # ensures a behavior that is consistent with the system tools.
    #
    # @param view [View] filter used to determine the descendants
    def remove_descendants(view = View::REMOVE)
      storage_remove_descendants(view)
      update_etc_status
    end

    # Name to represent the device
    #
    # @return [String, nil] nil if the device has no representation
    def display_name
      return nil unless respond_to?(:name)

      name
    end

    protected

    # Stores any object in the userdata of the device.
    #
    # This method takes care of serializing the information to make sure it fits
    # into the userdata mechanism.
    # @see #userdata
    #
    # @param key [#to_s] name of the information in the userdata container
    # @param value [Object] information to store
    def save_userdata(key, value)
      userdata[key.to_s] = value.to_yaml
    end

    # Returns a copy of any information previously stored in the device using
    # {#save_userdata}.
    #
    # This method takes care of deserializing the stored information.
    #
    # Take into account that the result is just a copy of the information, so
    # changes in the object will not be persisted to the userdata.
    # #{save_userdata} must be used to update the information in the device if
    # needed.
    #
    # @example Updating a value
    #
    #   save_userdata(:aliases, ["dev_one", "dev_two"])
    #
    #   userdata_value(:aliases).push "dev_three"
    #   userdata_value(:aliases) # => ["dev_one", "dev_two"]
    #
    #   tmp = userdata_value(:aliases)
    #   tmp.push "dev_three"
    #   save_userdata(:aliases, tmp)
    #   userdata_value(:aliases) # => ["dev_one", "dev_two", "dev_three"]
    #
    # @param key [#to_s] name of the information in the userdata container
    # @return [Object] a copy of the previously stored object
    def userdata_value(key)
      serialized = userdata[key.to_s]
      return nil if serialized.nil?

      if RUBY_VERSION.start_with?("2.")
        YAML.load(serialized) # rubocop:disable Security/YAMLLoad # here it is our data, so safe
      else
        # ruby3 from 3.1 defaults load to safe_load, so need explicit unsafe_load
        YAML.unsafe_load(serialized)
      end
    end

    # Generic mechanism to update the concrete attribute checked by {#in_etc?}
    def update_etc_attributes
      # Do something only for subclasses defining #assign_etc_attribute
      return unless respond_to?(:assign_etc_attribute, true)

      self.in_etc_initial = in_etc? if in_etc_initial.nil?

      should_be_in_etc = descendants.any?(&:in_etc?)

      # never set to false unless it was initially so
      assign_etc_attribute(should_be_in_etc) if [true, in_etc_initial].include? should_be_in_etc
    end

    # Triggers recalculation of {#in_etc?} for all parent objects
    def update_parents_etc_status
      parents.each(&:update_etc_status)
    end

    # The initial value of {#in_etc?}, before {#update_etc_attributes} changed it.
    #
    # @note This relies on the userdata mechanism, see {#userdata_value}.
    #
    # @return [Boolean, nil] the initial {#in_etc?} value; nil if the initial value
    #   hasn't been stored yet
    def in_etc_initial
      userdata_value(:in_etc_initial)
    end

    # Stores the information for {#in_etc_initial}
    #
    # @param value [Boolean]
    def in_etc_initial=(value)
      save_userdata(:in_etc_initial, value)
    end

    # @see #is?
    def types_for_is
      []
    end
  end
end
