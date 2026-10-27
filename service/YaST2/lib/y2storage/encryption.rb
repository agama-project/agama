# Copyright (c) [2017-2026] SUSE LLC
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

require "y2storage/storage_class_wrapper"
require "y2storage/blk_device"
require "y2storage/filesystems/mount_by_type"
require "y2storage/encryption_method"

module Y2Storage
  # An encryption layer on a block device
  #
  # This is a wrapper for Storage::Encryption
  class Encryption < BlkDevice
    wrap_class Storage::Encryption, downcast_to: ["Luks"]

    # @!attribute type
    #   Encryption type. Eg. luks1, luks2, etc.
    #
    #   @return [EncryptionType]
    #
    storage_forward :type, as: "EncryptionType"
    storage_forward :type=

    # @!method blk_device
    #   Block device directly hosting the encryption layer.
    #
    #   @return [BlkDevice] the block device being encrypted
    storage_forward :blk_device, as: "BlkDevice"

    # @!attribute password
    #   @return [String] the encryption password
    storage_forward :password
    storage_forward :password=

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<Encryption>] all the encryption devices in the given devicegraph
    storage_class_forward :all, as: "Encryption"

    # @!method in_etc_crypttab?
    #   @return [Boolean] whether the device is included in /etc/crypttab
    storage_forward :in_etc_crypttab?

    # @!attribute key_file
    #   @return [String] the encryption key file
    storage_forward :key_file
    storage_forward :key_file=

    # @!method use_key_file_in_commit?
    #   Whether the information at {#key_file} is used in the commit phase of libstorage-ng
    #   (in case it contains a valid value).
    #
    #   The default value is true, but it can be set to false in order to fill the third column
    #   of the crypttab file without actually affecting the creation of the device.
    #
    #   @return [Boolean]
    storage_forward :use_key_file_in_commit?

    # @!method use_key_file_in_commit=(value)
    #
    #   Sets the {#use_key_file_in_commit?} flag
    #
    #   @param value [Boolean]
    storage_forward :use_key_file_in_commit=

    # @!attribute cipher
    #   The encryption cipher
    #
    #   Currently only supported for LUKS
    #
    #   @return [String] if empty, the default of cryptsetup will be used during creation
    storage_forward :cipher
    storage_forward :cipher=

    # @!attribute key_size
    #   The key size in bytes
    #
    #   Currently only supported for LUKS
    #
    #   Note the value is expressed in bytes. That's dictated by libstorage-ng, even when cryptsetup
    #   and all the LUKS-related documentation use bits for expressing the key size.
    #
    #   @return [Integer] if zero, the default of cryptsetup will be used during creation
    storage_forward :key_size
    storage_forward :key_size=

    # @!attribute pbkdf_value
    #   String representation of {#pbkdf}, an empty string is equivalent to a nil value on {#pbkdf}
    #
    #   @return [String]
    storage_forward :pbkdf_value, to: :pbkdf
    storage_forward :pbkdf_value=, to: :pbkdf=

    # @!attribute crypt_options
    #   Options in the fourth field of /etc/crypttab
    #
    #   @note This returns an array based on the underlying SWIG vector,
    #   modifying the returned object will have no effect in the Encryption
    #   object. Use #crypt_options= to actually change the value.
    #
    #   @return [Array<String>] options for the encryption
    storage_forward :crypt_options

    # @!attribute open_options
    #
    # Extra options for open call. The options are injected as-is to the
    # command so must be properly quoted.
    #
    # @return [String]
    storage_forward :open_options
    storage_forward :open_options=

    # Sets crypt options
    #
    # @param options [Array<String>]
    def crypt_options=(options)
      to_storage_value.crypt_options.clear
      options&.each { |o| to_storage_value.crypt_options << o }
    end

    # The setter is intentionally hidden. See similar comment for Md#in_etc_mdadm
    storage_forward :storage_in_etc_crypttab=, to: :in_etc_crypttab=
    private :storage_in_etc_crypttab=

    # @!method set_default_mount_by
    #   Set the mount-by method to the global default, see Storage::get_default_mount_by()
    storage_forward :set_default_mount_by, to: :default_mount_by=

    # @see BlkDevice#plain_device
    def plain_device
      blk_device
    end

    # @see Device#in_etc?
    # @see #in_etc_crypttab?
    def in_etc?
      in_etc_crypttab?
    end

    # @!attribute mount_by
    #   This defines the form of the second field in the crypttab file.
    #
    #   The concrete meaning depends on the value. Note that some types address
    #   the encryption device while others address the underlying device.
    #
    #   * DEVICE: the kernel device name or a link in /dev (but not in /dev/disk)
    #     of the plain device being encrypted.
    #   * UUID: the UUID of the LUKS device. This only works with LUKS,
    #     useless with plain encryption.
    #   * LABEL: the label of the LUKS device. This only works with LUKS2, there
    #     are no labels in LUKS1 or in plain encryption.
    #   * ID: one of the /dev/disk/by-id links to the plain device being encrypted.
    #   * PATH: one of the /dev/disk/by-path links to the plain device being encrypted.
    #
    #   Not to be confused with {Mountable#mount_by}, which refers to the form
    #   of the fstab file.
    #
    #   @return [Filesystems::MountByType]
    storage_forward :mount_by, as: "Filesystems::MountByType"
    storage_forward :mount_by=

    # Low level setter to enforce a value for {#dm_table_name} without
    # updating {#auto_dm_name?}
    #
    # @see #dm_table_name=
    alias_method :assign_dm_table_name, :dm_table_name=

    # Overloaded setter for {#dm_table_name} with ensures a consistent value for
    # #{auto_dm_name?} to make sure names set via the setter are not
    # auto-adjusted later.
    #
    # @see #assign_dm_table_name
    #
    # @param name [String]
    def dm_table_name=(name)
      self.auto_dm_name = false
      super
    end

    # Base name to use as fallback for the auto generated DM name when none of the candidate names
    # is valid, see {#auto_dm_table_name}.
    DM_BASE_NAME_FALLBACK = "device".freeze
    private_constant :DM_BASE_NAME_FALLBACK

    # Generates a device mapper name for the encryption device
    #
    # This name is used for devices with auto dm names, see {.update_dm_names}.
    #
    # @note If there is no valid candidate name, then a fallback name like "cr_device_1" is used
    #
    # @return [String]
    def auto_dm_table_name
      name = candidate_auto_dm_table_names.find { |c| self.class.valid_dm_table_name?(c) }
      name || generate_auto_dm_table_name(DM_BASE_NAME_FALLBACK)
    end

    # Whether {#dm_table_name} was automatically set by YaST.
    #
    # @note This relies on the userdata mechanism, see {#userdata_value}.
    #
    # @return [Boolean] false if the name was explicitly set via the overloaded
    #   setter or in general if the origin is unknown
    def auto_dm_name?
      !!userdata_value(:auto_dm_name)
    end

    # Enforces de value for {#auto_dm_name?}
    #
    # @note This relies on the userdata mechanism, see {#userdata_value}.
    #
    # @param value [Boolean]
    def auto_dm_name=(value)
      save_userdata(:auto_dm_name, value)
    end

    # @see BlkDevice#stable_name?
    #
    # For encryption devices configured during boot, their name is based on
    # the DeviceMapper specified in the crypttab file. So it should remain
    # stable across reboots.
    #
    # @return [Boolean]
    def stable_name?
      true
    end

    # Whether the encryption device matches with a given crypttab spec
    #
    # The second column of /etc/crypttab contains a path to the underlying
    # device of the encrypted device. For example:
    #
    # /dev/sda2
    # /dev/disk/by-id/scsi-0ATA_Micron_1100_SATA_1652155452D8-part2
    # /dev/disk/by-uuid/7a0c6309-7063-472b-8301-f52b0a92d8e9
    # /dev/disk/by-path/pci-0000:00:17.0-ata-3-part2
    #
    # This method checks whether the underlying device of the encryption is the
    # device indicated in the second column of a crypttab entry.
    #
    # Take into account that libstorage-ng discards during probing all the
    # udev names not considered reliable or stable enough. This method only
    # checks by the udev names recognized by libstorage-ng (not discarded).
    #
    # @param spec [String] content of the second column of an /etc/crypttab entry
    # @return [Boolean]
    def match_crypttab_spec?(spec)
      blk_device.name == spec || blk_device.udev_full_all.include?(spec)
    end

    # Whether the crypttab name is known for this encryption device
    #
    # @return [Boolean]
    def crypttab_name?
      !crypttab_name.nil?
    end

    # Name specified in the crypttab file for this encryption device
    #
    # @note This relies on the userdata mechanism, see {#userdata_value}.
    #
    # @return [String, nil] nil if crypttab name is not known
    def crypttab_name
      userdata_value(:crypttab_name)
    end

    # Saves how this encryption device is known in the crypttab file
    #
    # @note This relies on the userdata mechanism, see {#save_userdata}.
    def crypttab_name=(value)
      save_userdata(:crypttab_name, value)
    end

    # Returns the encryption method used
    #
    # Note that it could be inferred if there is no encryption process available yet
    #
    # @see #encryption_process
    #
    # @return [EncryptionMethod, nil]
    def method
      encryption_process ? encryption_process.method : EncryptionMethod.for_device(self)
    end

    # Returns the process used to perform the encryption
    #
    # @note The EncryptionProcess object is persisted using the userdata mechanism,
    #   but it's also cached in an instance variable because, otherwise, every call
    #   to #encryption_process would be accessing the object that was stored in the
    #   devicegraph, with its former state. Thus, all the modifications would be lost.
    #   See {#encryption_process=} and {#save_encryption_process}.
    #
    # @return [EncryptionProcess::Base, nil]
    def encryption_process
      @encryption_process ||= userdata_value(:encryption_process)
    end

    # Saves the given encryption process
    #
    # @note Keeping the state of this object is important, so see {#encryption_process}
    #   and {#save_encryption_process} for some considerations about how it is
    #   persisted into the devicegraph and how the current state is held.
    #
    # @param value [Encryption::Processes]
    def encryption_process=(value)
      save_userdata(:encryption_process, value)
      @encryption_process = value
    end

    # Returns the encryption authentication type
    #
    # @return [EncryptionAuthentication, nil] nil if such value does not exist
    def authentication
      userdata_value(:encryption_authentication)
    end

    # Saves the given encryption authentication type
    #
    # @param value [EncryptionAuthentication]
    def authentication=(value)
      save_userdata(:encryption_authentication, value)
    end

    # Executes the actions that must be performed right before the devicegraph is
    # committed to the system
    def pre_commit
      return unless encryption_process

      encryption_process.pre_commit(self)
      save_encryption_process
    end

    # Executes the actions that must be performed after the devicegraph has been
    # committed to the system
    def post_commit
      return unless encryption_process

      encryption_process.post_commit(self)
      save_encryption_process
    end

    # Executes the actions that must be performed at the end of the installation,
    # before unmounting the target system, when all the so-called finish clients
    # are executed
    def finish_installation
      encryption_process&.finish_installation(self)
    end

    # Features that must be supported in the target system to finish the encryption
    # process
    #
    # @return [Array<YastFeature>]
    def commit_features
      encryption_process&.commit_features || []
    end

    # If the current mount_by is suitable, it does nothing.
    #
    # Otherwise, it assigns the best option from all the suitable ones
    #
    # @see #suitable_mount_by?
    def ensure_suitable_mount_by
      return if suitable_mount_by?(mount_by)

      self.mount_by = Filesystems::MountByType.best_for(blk_device, suitable_mount_bys)
    end

    # Options that must be propagated from the fstab entries of the mount points
    # to the crypttab entries of the corresponding device
    OPTIONS_TO_PROPAGATE = {
      "_netdev"        => "_netdev",
      "noauto"         => "noauto",
      "nofail"         => "nofail",
      "x-initrd.mount" => "x-initrd.attach"
    }

    # Options that must be added to crypttab entries for specific mount points.
    OPTIONS_TO_ADD = {
      "/" => "x-initrd.attach"
    }
    private_constant :OPTIONS_TO_PROPAGATE, :OPTIONS_TO_ADD

    # Synchronizes {#crypt_options} with the {MountPoint#mount_options} of the
    # mount points associated to this encryption device
    #
    # This also adds crypttab options that are needed for specific mount points.
    #
    # This must be called after creating a new encryption device and after
    # modifying the options of any of the mount points associated to it.
    def adjust_crypt_options
      # Let's ignore mount points of subvolumes, since they usually only contain 'subvol=$path'.
      # Moreover, libstorage-ng currently enforces that behavior.
      mount_points = descendants.select { |d| d.is?(:filesystem) }.map(&:mount_point).compact

      OPTIONS_TO_PROPAGATE.each_pair do |fstab_opt, crypttab_opt|
        propagate_mount_option(fstab_opt, crypttab_opt, mount_points)
      end

      OPTIONS_TO_ADD.each_pair do |mountpoint, crypttab_opt|
        self.crypt_options |= [crypttab_opt] if mount_points.any? { |m| m.path == mountpoint }
      end
    end

    # Sets {#mount_by} to a value that makes sense
    #
    # Generally, that means simply ensuring a suitable mount_by value. But it also may imply
    # correcting the surprising value set by libstorage-ng when probing an already existing
    # encryption device.
    #
    # During probing, libstorage-ng sets Encryption#mount_by for all the found encryption devices.
    # If the device is listed in /etc/crypttab, libstorage-ng sets the mount_by value based on the
    # value on that file. If that's not the case, libstorage-ng sets Encryption#mount_by to a
    # hardcoded value of DEVICE, completely ignoring the default mount_by value that is configured
    # for the system. That leads to problems like the one described in bsc#1165702.
    # See https://github.com/yast/yast-storage-ng/pull/1095 for more details.
    #
    # For devices affected by that problem, this method first tries to re-initialize mount_by to
    # a value aligned with the storage-ng configuration and, thus, with user expectations.
    def adjust_mount_by
      # It may be more correct to do this only once (since it's fixing a wrong initialization).
      # But since there is no way in the UI or AutoYaST to explicitly modify (even to display) the
      # value of Encryption#mount_by, it's safe (even maybe expected) to re-evaluate it.
      set_default_mount_by if probed_without_crypttab?

      ensure_suitable_mount_by
    end

    # @see Device#update_etc_attributes
    def assign_etc_attribute(value)
      self.storage_in_etc_crypttab = value
    end

    # PBKDF (Password-Based Key Derivation Function), currently only supported for LUKS2 where
    # this attribute corresponds to the PBKDF of the first used keyslot.
    #
    # If is set to nil, during the commit phase the default of cryptsetup will be used.
    #
    # @return [PbkdFunction, nil]
    def pbkdf
      PbkdFunction.find(pbkdf_value)
    end

    # @see #pbkdf
    #
    # @param function [PbkdFunction, nil]
    def pbkdf=(function)
      self.pbkdf_value = function&.value || ""
    end

    # Whether the attribute #pbkdf makes sense for this object
    #
    # @return [Boolean]
    def supports_pbkdf?
      type.is?(:luks2)
    end

    # Whether the attribute #label makes sense for this object
    #
    # @return [Boolean]
    def supports_label?
      type.is?(:luks2)
    end

    # Whether the attribute #authentication makes sense for this object
    #
    # @return [Boolean]
    def supports_authentication?
      method.is?(:systemd_fde)
    end

    # Whether the attribute #cipher makes sense for this object
    #
    # @return [Boolean]
    def supports_cipher?
      type.is?(:luks1, :luks2)
    end

    # Whether the attribute #key_size makes sense for this object
    #
    # @return [Boolean]
    def supports_key_size?
      type.is?(:luks1, :luks2)
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :encryption
    end

    # Updates the userdata with an up-to-date version of the encryption process
    #
    # @see #encryption_process
    def save_encryption_process
      self.encryption_process = encryption_process
    end

    # Whether the given type makes sense for the {#mount_by} attribute of the
    # encryption device
    #
    # Using a value that is not suitable would lead to libstorage-ng ignoring
    # that value during the commit phase. In such case, DEVICE is used by the
    # library as fallback.
    #
    # @param type [Filesystems::MountByType]
    # @return [Boolean]
    def suitable_mount_by?(type)
      return true if type.is?(:device)
      return true if type.is?(:id) && blk_device.udev_ids.any?
      return true if type.is?(:path) && blk_device.udev_paths.any?

      false
    end

    # List of all the mount_by types that are suitable for this encryption
    # device
    #
    # @see #suitable_mount_by?
    #
    # @return [Array<Filesystems::MountByType>]
    def suitable_mount_bys
      Filesystems::MountByType.all.select { |type| suitable_mount_by?(type) }
    end

    # @see #adjust_crypt_options
    #
    # @param fstab_option [String] option from fstab
    # @param crypttab_option [String] option for crypttab
    # @param mount_points [Array<MountPoint>] relevant mount points associated
    #   to the encryption device
    def propagate_mount_option(fstab_option, crypttab_option, mount_points)
      in_mount_points = mount_points.all? { |mp| mp.mount_options.include?(fstab_option) }
      in_encryption = crypt_options.include?(crypttab_option)

      if in_mount_points && !in_encryption
        self.crypt_options = crypt_options + [crypttab_option]
      elsif !in_mount_points && in_encryption
        self.crypt_options = crypt_options - [crypttab_option]
      end
    end

    # Candidate device mapper names for the encryption device
    #
    # TODO: Better encryption names can be generated for indirectly used encryption devices (e.g., an
    # encrypted device used as LVM PV). But this implies to update the auto generated device mapper
    # names at some quite points, for example, when a device is added/removed to a LVM VG, MD RAID,
    # etc.
    #
    # Another option could be to update the encryption names just before the commit action, but in that
    # case, the devicegraph would contain temporary encryption names all the time. Temporary names are
    # a problem if they are presented to the user in the UI.
    #
    # Note that any change to the encryption name generation could affect to the pervasive encryption
    # key generation, specially when probed encryption names are modified. Right now, probed names are
    # not touched.
    def candidate_auto_dm_table_names
      candidates = []
      candidates << blk_device.dm_table_name unless blk_device.dm_table_name.empty?
      candidates << mount_point_to_dm_name unless mount_point.nil?
      candidates += blk_device.udev_ids
      candidates << blk_device.basename

      candidates.map { |c| generate_auto_dm_table_name(c) }
    end

    # Generates an unused device mapper name for the encryption device based on the given name
    #
    # @param name [String]
    # @return [String]
    def generate_auto_dm_table_name(name)
      self.class.ensure_unused_dm_name(devicegraph, "cr_#{name}")
    end

    # Generates a base dm name from the mount point path
    #
    # @return [String, nil] nil if the encryption has no mount point.
    def mount_point_to_dm_name
      return nil if mount_point.nil?

      return "root" if mount_point.root?

      # Removes trailing slashes and replaces internal slashes by underscore
      mount_point.path.gsub(/^\/|\/$/, "").gsub("/", "_")
    end

    # Checks whether the initial value of mount_by was forced to DEVICE by libstorage-ng due to lack
    # of information or whether is the result of a proper initialization during normal operation
    #
    # @see #adjust_mount_by
    #
    # @return [Boolean]
    def probed_without_crypttab?
      return false unless exists_in_probed?
      return !in_etc_crypttab? if in_etc_initial.nil?

      !in_etc_initial
    end

    class << self
      # Updates the DeviceMapper name for all encryption devices in the device
      # that have a name automatically set by YaST.
      #
      # This is useful to ensure the names of the encryptions are still
      # consistent with the names of the block devices they are associated to,
      # since some devices (like partitions) use to change their names over
      # time.
      #
      # Note that names automatically set by libstorage-ng itself (typically of
      # the form cr-auto-$NUM) are not marked as auto-generated and, thus, are
      # not modified by this method. Modifying such names can confuse
      # libstorage-ng.
      #
      # @param devicegraph [Devicegraph]
      def update_dm_names(devicegraph)
        encryptions = all(devicegraph).select(&:auto_dm_name?).sort_by(&:sid)

        # Reset all auto-generated names...
        encryptions.each do |enc|
          enc.assign_dm_table_name("")
        end

        # ...reassign them according to the current names of the block devices
        encryptions.each do |enc| # rubocop:disable Style/CombinableLoops Cannot be combined
          enc.assign_dm_table_name(enc.auto_dm_table_name)
        end
      end

      # Ensures that the given dm name is not used yet by adding a suffix if needed
      #
      # @param devicegraph [Devicegraph]
      # @param dm_name [String]
      #
      # @return [String]
      def ensure_unused_dm_name(devicegraph, dm_name)
        suffix = ""

        loop do
          candidate = "#{dm_name}#{suffix}"
          return candidate unless dm_name_in_use?(devicegraph, candidate)

          suffix = next_dm_name_suffix(suffix)
        end
      end

      private

      # Checks whether a given DeviceMapper table name is already in use by some
      # of the devices in the given devicegraph
      #
      # @param devicegraph [Devicegraph]
      # @param name [String]
      # @return [Boolean]
      def dm_name_in_use?(devicegraph, name)
        devicegraph.blk_devices.any? { |i| i.dm_table_name == name }
      end

      # @see #ensure_unused_dm_name
      #
      # @param previous [String] previous value of the suffix
      # @return [String]
      def next_dm_name_suffix(previous)
        previous_num = previous.empty? ? 1 : previous.split("_").last.to_i
        "_#{previous_num + 1}"
      end
    end
  end
end
