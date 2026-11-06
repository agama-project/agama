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
require "installation/autoinst_profile/section_with_attributes"
require "y2storage/subvol_specification"

module Y2Storage
  module AutoinstProfile
    # Thin object oriented layer on top of a <partition> section of the
    # AutoYaST profile.
    #
    # More information can be found in the 'Partitioning' section ('Partition
    # Configuration' subsection) of the AutoYaST documentation:
    # https://www.suse.com/documentation/sles-12/singlehtml/book_autoyast/book_autoyast.html#ay.partition_configuration
    # Check that document for details about the semantic of every attribute.
    class PartitionSection < ::Installation::AutoinstProfile::SectionWithAttributes
      ATTRIBUTES = [
        { name: :create },
        { name: :filesystem },
        { name: :format },
        { name: :label },
        { name: :uuid },
        { name: :lv_name },
        { name: :lvm_group },
        { name: :mount },
        { name: :mountby },
        { name: :partition_id },
        { name: :partition_nr },
        { name: :partition_type },
        { name: :subvolumes },
        { name: :size },
        { name: :crypt_fs },
        { name: :loop_fs },
        { name: :crypt_method },
        { name: :crypt_key },
        { name: :crypt_pbkdf },
        { name: :crypt_label },
        { name: :crypt_cipher },
        { name: :crypt_key_size },
        { name: :crypt_pervasive_apqns },
        { name: :crypt_pervasive_key_type },
        { name: :raid_name },
        { name: :raid_options },
        { name: :mkfs_options },
        { name: :fstab_options, xml_name: :fstopt },
        { name: :subvolumes_prefix },
        { name: :create_subvolumes },
        { name: :resize },
        { name: :pool },
        { name: :used_pool },
        { name: :stripes },
        { name: :stripe_size, xml_name: :stripesize },
        { name: :bcache_backing_for },
        { name: :bcache_caching_for },
        { name: :device },
        { name: :btrfs_name },
        { name: :quotas }
      ].freeze
      private_constant :ATTRIBUTES

      def self.attributes
        ATTRIBUTES
      end

      define_attr_accessors

      # @!attribute create
      #   @return [Boolean] whether the partition must be created or exists

      # @!attribute crypt_fs
      #   @return [Boolean] whether the partition must be encrypted.
      #   @deprecated Use #crypt_method instead.

      # @!attribute crypt_method
      #   @return [Symbol,nil] encryption method (:luks1, :pervasive_luks2,
      #     :protected_swap, :random_swap or :secure_swap). See {Y2Storage::EncryptionMethod}.

      # @!attribute crypt_key
      #   @return [String] encryption key

      # @!attribute crypt_pbkdf
      #   @return [Symbol,nil] password-based derivation function for LUKS2 (:pbkdf2, :argon2i,
      #     :argon2id). See {Y2Storage::PbkdFunction}.

      # @!attribute crypt_label
      #   @return [String,nil] LUKS label if LUKS2 is going to be used

      # @!attribute crypt_cipher
      #   @return [String,nil] specific cipher if LUKS is going to be used
      #
      # @!attribute crypt_key_size
      #   Specific key size (in bits) if LUKS is going to be used
      #
      #   @return [Integer,nil] If nil, the default key size will be used. If an integer
      #     value is used, it has to be a multiple of 8.

      # @!attribute crypt_pervasive_apqns
      #   @return [Array<String>,nil] items like "01.0001"
      #
      # @!attribute crypt_pervasive_key_type
      #   @return [String,nil] "CCA-AESCIPHER" or "CCA-AESDATA"

      # @!attribute filesystem
      #   @return [Symbol] file system type to use in the partition, it also
      #     influences other fields
      #   @see #type_for_filesystem
      #   @see #id_for_partition

      # @!attribute partition_id
      #   @return [Integer] partition id. See #id_for_partition

      # @!attribute format
      #   @return [Boolean] whether the partition should be formatted

      # @!attribute label
      #   @return [String] label of the filesystem

      # @!attribute uuid
      #   @return [String] UUID of the partition, only useful for reusing
      #     existing filesystems

      # @!attribute lv_name
      #   @return [String] name of the LVM logical volume

      # @!attribute mount
      #   @return [String] mount point for the partition

      # @!attribute mountby
      #   @return [Symbol] :device, :label, :uuid, :path or :id
      #   @see #type_for_mountby

      # @!attribute partition_nr
      #   @return [Integer] the partition number of this partition

      # @!attribute partition_type
      #   @return [String, nil] the partition type of this partition (only can be "primary")

      # @!attribute subvolumes
      #   @return [Array<SubvolSpecification>,nil] list of subvolumes or nil if not
      #     supported (from storage) or not specified (from hashes)

      # @!attribute size
      #   @return [String] size of the partition in the flexible AutoYaST format

      # @!attribute loop_fs
      #   @return [Boolean] undocumented attribute

      # @!attribute raid_name
      #   @return [String] RAID name in which this partition will be included

      # @!attribute raid_options
      #   @return [RaidOptionsSection] RAID options
      #   @see RaidOptionsSection

      # @!attribute mkfs_options
      #   @return [String] mkfs options
      #
      # @!attribute fstab_options
      #   @return [Array<String>] Options to be used in the fstab for the filesystem

      # @!attribute subvolumes_prefix
      #   @return [String] Name of the default Btrfs subvolume

      # @!attribute device
      #   @return [String, nil] undocumented attribute, but used to indicate a NFS
      #     share when installing over NFS (with the old profile format)

      # @!attribute btrfs_name
      #   @return [String] Btrfs in which this partition will be included

      # @!attribute quotas
      #   @return [Boolean] Whether support for quotas is enabled or not

      def init_from_hashes(hash)
        super

        if hash["raid_options"]
          @raid_options = RaidOptionsSection.new_from_hashes(hash["raid_options"], self)
        end

        @crypt_pervasive_apqns = hash["crypt_pervasive_apqns"] if hash["crypt_pervasive_apqns"]

        @subvolumes_prefix = hash["subvolumes_prefix"]
        @create_subvolumes = hash.fetch("create_subvolumes", true)
        @subvolumes = subvolumes_from_hashes(hash["subvolumes"]) if hash["subvolumes"]
        @bcache_caching_for = hash.fetch("bcache_caching_for", [])

        @fstab_options = hash["fstopt"].split(",").map(&:strip) if hash["fstopt"]
      end

      # Clones a device into an AutoYaST profile section by creating an instance
      # of this class from the information of a device
      #
      # @see PartitioningSection.new_from_storage for more details
      #
      # @param device [Device] a device that can be cloned into a <partition> section,
      #   like a partition, an LVM logical volume, an MD RAID, a NFS filesystem or a
      #   Btrfs multi-device.
      # @return [PartitionSection]
      def self.new_from_storage(device, parent = nil)
        exporter = PartitionExporter.new(device)
        exporter.section(parent)
      end

      # Filesystem type to be used for the real partition object, based on the
      # #filesystem value.
      #
      # @return [Filesystems::Type, nil] nil if #filesystem is not set or it's
      #   impossible to infer the type
      def type_for_filesystem
        return nil unless filesystem

        Filesystems::Type.find(filesystem)
      rescue NameError
        nil
      end

      # Name schema type to be used for the real partition object, based on the
      # #filesystem value
      #
      # @return [Filesystems::MountByType, nil] nil if #filesystem is not set
      #   or it's impossible to infer the type
      def type_for_mountby
        return nil unless mountby

        Filesystems::MountByType.find(mountby)
      rescue NameError
        nil
      end

      # Partition id to be used for the real partition object.
      #
      # This implements the AutoYaST documented logic. If #partition_id is
      # filled, the corresponding id is used. Otherwise SWAP or LINUX will be
      # used, depending on the value of #filesystem.
      #
      # @return [PartitionId]
      def id_for_partition
        return PartitionId.new_from_legacy(partition_id) if partition_id
        return PartitionId::SWAP if type_for_filesystem&.is?(:swap)

        PartitionId::LINUX
      end

      # Device name to be used for the real MD device
      #
      # This implements the AutoYaST documented logic, if 'raid_name' is
      # provided as one of the corresponding 'raid_options', that name should be
      # used. Otherwise the name will be inferred from 'partition_nr'.
      #
      # @return [String] MD RAID device name
      def name_for_md
        name = raid_options&.raid_name
        return name unless name.nil? || name.empty?

        "/dev/md/#{partition_nr}"
      end

      # Name to reference a multi-device Btrfs (used when exporting).
      #
      # @param filesystem [Filesystems::BlkFilesystem, nil]
      # @return [String, nil]
      def name_for_btrfs(filesystem)
        return nil unless filesystem&.multidevice? && filesystem&.is?(:btrfs)

        "btrfs_#{filesystem.sid}"
      end

      def to_hashes
        hash = super
        hash["fstopt"] = fstab_options.join(",") if fstab_options && !fstab_options.empty?
        if subvolumes
          hash["create_subvolumes"] = !subvolumes.empty?
          hash["subvolumes"] = subvolumes_to_hashes
          hash["subvolumes_prefix"] = subvolumes_prefix
        end
        hash
      end

      # Return section name
      #
      # @return [String] "partitions"
      def collection_name
        "partitions"
      end

      protected

      # Returns an array of hashes representing subvolumes
      #
      # AutoYaST only uses a subset of subvolumes properties: 'path', 'copy_on_write'
      # and 'referenced_limit'.
      #
      # @return [Array<Hash>] Array of hash-based representations of subvolumes
      def subvolumes_to_hashes
        subvolumes.map do |subvol|
          subvol_path = subvol.path.sub(/\A#{@subvolumes_prefix}\//, "")
          hash = { "path" => subvol_path, "copy_on_write" => subvol.copy_on_write }
          if subvol.referenced_limit && !subvol.referenced_limit.unlimited?
            hash["referenced_limit"] = subvol.referenced_limit.to_s
          end
          hash
        end
      end

      # Return a list of subvolumes from an array of hashes
      #
      # This method builds a list of SubvolSpecification objects from an array
      # of subvolumes in hash form (according to AutoYaST specification).
      #
      # Additionally, it filters out "@" subvolumes entries which were
      # generated by older AutoYaST versions. See bnc#1061253.
      #
      # @param hashes [Array<Hash>] List of subvolumes in hash form
      # @return [Array<SubvolSpecification>] List of subvolumes
      def subvolumes_from_hashes(hashes)
        subvolumes = SubvolSpecification.list_from_control_xml(hashes)
        subvolumes.reject { |s| s.path == "@" }
      end

      # Auxiliary class to encapsulate the conversion from storage objects to their
      # representation as {PartitionSection}
      class PartitionExporter
        # Literal historically used at AutoinstPartPlan
        CRYPT_KEY_VALUE = "ENTER KEY HERE"
        private_constant :CRYPT_KEY_VALUE

        # Partitions with these IDs are historically marked with format=false
        # NOTE: "Dell Utility" was included here, but there is no such ID in the
        # new libstorage.
        NO_FORMAT_IDS = [PartitionId::PREP, PartitionId::DOS16]
        private_constant :NO_FORMAT_IDS

        # Partitions with these IDs are historically marked with create=false
        # NOTE: "Dell Utility" was the only entry here. See above.
        NO_CREATE_IDS = []
        private_constant :NO_CREATE_IDS

        # Encryption method to use when the method of an encryption device cannot be determined
        DEFAULT_ENCRYPTION_METHOD = Y2Storage::EncryptionMethod.find(:luks1)
        private_constant :DEFAULT_ENCRYPTION_METHOD

        # @return [Device] a device that can be cloned into a <partition> section,
        #   like a partition, an LVM logical volume, an MD RAID or a NFS filesystem.
        attr_reader :device

        # Constructor
        #
        # @param device [Device] see {#device}
        def initialize(device)
          @device = device
        end

        # Method used by {PartitionSection.new_from_storage} to populate the attributes when
        # cloning a partition device.
        #
        # As usual, it keeps the behavior of the old clone functionality, check
        # the implementation of this class for details.
        #
        # @return [PartitionSection]
        def section(parent)
          result = PartitionSection.new(parent)
          result.create = true
          result.resize = false

          init_fields_by_type(result)

          # Exporting these values only makes sense when the device is a block device. Note that some
          # exported devices (e.g., multi-device Btrfs and NFS filesystems) are not block devices.
          return result unless device.is?(:blk_device)

          init_encryption_fields(result)
          init_filesystem_fields(result) unless device.filesystem&.multidevice?

          # NOTE: The old AutoYaST exporter does not report the real size here.
          # It intentionally reports one cylinder less. Cylinders is an obsolete
          # unit (that equals to 8225280 bytes in my experiments).
          # According to the comments there, that was done due to bnc#415005 and
          # bnc#262535.
          result.size = device.size.to_i.to_s if result.create && !fixed_size?

          result
        end

        protected

        # @param section [PartitionSection] section object to modify based on the device
        def init_fields_by_type(section)
          if device.is?(:lvm_lv)
            init_lv_fields(section)
          elsif device.is?(:disk_device, :software_raid, :stray_blk_device, :bcache)
            init_disk_device_fields(section)
          elsif device.is?(:nfs)
            init_nfs_fields(section)
          elsif device.is?(:tmpfs)
            init_tmpfs_fields(section)
          elsif device.is?(:blk_filesystem)
            init_blk_filesystem_fields(section, device)
          else
            init_partition_fields(section)
          end
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_partition_fields(section)
          section.create = !NO_CREATE_IDS.include?(device.id)
          section.partition_nr = device.number
          section.partition_type = "primary" if primary_partition?
          section.partition_id = partition_id
          section.lvm_group = lvm_group_name
          section.raid_name = device.md.name if device.md
          section.btrfs_name = section.name_for_btrfs(device.filesystem)
          init_bcache_fields(section)
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_disk_device_fields(section)
          section.create = false
          section.lvm_group = lvm_group_name
          section.raid_name = device.md.name if device.respond_to?(:md) && device.md
          section.btrfs_name = section.name_for_btrfs(device.filesystem)
          init_bcache_fields(section)
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_lv_fields(section)
          section.lv_name = device.basename
          section.stripes = device.stripes
          section.stripe_size = device.stripe_size.to_i / DiskSize.KiB(1).to_i
          section.pool = device.lv_type == LvType::THIN_POOL
          parent = device.parents.first
          section.used_pool = parent.lv_name if device.lv_type == LvType::THIN && parent.is?(:lvm_lv)
          section.btrfs_name = section.name_for_btrfs(device.filesystem)
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_encryption_fields(section)
          return unless device.encrypted?

          method = device.encryption.method || DEFAULT_ENCRYPTION_METHOD
          section.loop_fs = true
          section.crypt_method = method.id
          section.crypt_key = CRYPT_KEY_VALUE if method.password_required?
          init_luks_fields(section)
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_luks_fields(section)
          enc = device.encryption
          section.crypt_pbkdf = enc.pbkdf&.to_sym if enc.supports_pbkdf?
          section.crypt_label = enc.label if enc.supports_label? && !enc.label.empty?
          section.crypt_cipher = enc.cipher if enc.supports_cipher? && !enc.cipher.empty?
          section.crypt_key_size = enc.key_size * 8 if enc.supports_key_size? && !enc.key_size.zero?
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_filesystem_fields(section)
          section.format = false
          fs = device.filesystem
          return unless fs

          section.format = true if device.respond_to?(:id) && !NO_FORMAT_IDS.include?(device.id)

          init_blk_filesystem_fields(section, fs)
        end

        # @param section [PartitionSection] section object to modify based on the device
        # @param filesystem [Filesystems::BlkFilesystem]
        def init_blk_filesystem_fields(section, filesystem)
          section.filesystem = filesystem.type.to_sym
          section.label = filesystem.label unless filesystem.label.empty?
          section.mkfs_options = filesystem.mkfs_options unless filesystem.mkfs_options.empty?
          section.quotas = filesystem.quota? if filesystem.respond_to?(:quota?)
          init_subvolumes(section, filesystem)
          init_mount_options(section, filesystem)
        end

        # @param section [PartitionSection] section object to modify based on the device
        # @param filesystem [Filesystems::BlkFilesystem]
        def init_mount_options(section, filesystem)
          return if filesystem.mount_point.nil?

          section.mount = filesystem.mount_point.path
          section.mountby = filesystem.mount_point.mount_by.to_sym
          mount_options = filesystem.mount_point.mount_options
          section.fstab_options = mount_options unless mount_options.empty?
        end

        # @param section [PartitionSection] section object to modify based on the device
        # @param filesystem [Filesystems::BlkFilesystem] Filesystem to add subvolumes if required
        def init_subvolumes(section, filesystem)
          return unless filesystem.supports_btrfs_subvolumes?

          section.subvolumes_prefix = filesystem.subvolumes_prefix

          valid_subvolumes = filesystem.btrfs_subvolumes.reject do |subvol|
            subvol.path.empty? || subvol.path == section.subvolumes_prefix ||
              subvol.path.start_with?(filesystem.snapshots_root)
          end

          section.subvolumes = valid_subvolumes.map do |subvol|
            SubvolSpecification.create_from_btrfs_subvolume(subvol)
          end
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_bcache_fields(section)
          if device.bcache
            section.bcache_backing_for = device.bcache.name
          elsif device.in_bcache_cset
            section.bcache_caching_for = device.in_bcache_cset.bcaches.map(&:name)
          end
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_nfs_fields(section)
          section.create = false
          init_mount_options(section, device)
        end

        # @param section [PartitionSection] section object to modify based on the device
        def init_tmpfs_fields(section)
          section.create = nil
          section.resize = nil
          init_mount_options(section, device)
          section.mountby = nil
        end

        # Uses legacy ids for backwards compatibility. For example, BIOS Boot
        # partitions in the old libstorage were represented by the internal
        # code 259 and, thus, systems cloned with the old exporter
        # (AutoinstPartPlan) use 259 instead of the current 257.
        def partition_id
          id = enforce_bios_boot? ? PartitionId::BIOS_BOOT : device.id
          id.to_i_legacy
        end

        # Whether the given existing partition should be reported as GRUB (GPT
        # Bios Boot) in the cloned profile.
        #
        # @note To ensure backward compatibility, this method implements the
        # logic present in the old AutoYaST exporter that used to live in
        # AutoinstPartPlan#ReadHelper.
        # https://github.com/yast/yast-autoinstallation/blob/47c24fb98e074f5b6432f3a4f8b9421362ee29cc/src/modules/AutoinstPartPlan.rb#L345
        # Thus, this returns true for any partition with a Windows-related ID
        # that is configured to be mounted in /boot*
        # See commit 54e236cd428636b3bf8f92d2ac2914e5b1d67a90 of
        # yast-autoinstallation.
        #
        # @return [Boolean]
        def enforce_bios_boot?
          return false if device.filesystem_mountpoint.nil?

          device.id.is?(:windows_system) && device.filesystem_mountpoint.include?("/boot")
        end

        # Returns the volume group associated to a given device
        #
        # @return [String,nil] Volume group; nil if it is not used as a physical volume or does
        #   not belong to any volume group.
        def lvm_group_name
          return nil if device.lvm_pv.nil? || device.lvm_pv.lvm_vg.nil?

          device.lvm_pv.lvm_vg.basename
        end

        # Determines whether the device has a fixed size (disk, RAID, etc.)
        #
        # It is used to find out whether the size specification should be included
        # in the profile.
        #
        # @return [Boolean]
        def fixed_size?
          device.is?(:disk_device, :software_raid)
        end

        # Determines whether the partition is primary or not
        #
        # Always false when the partition table does not allow extended partitions
        #
        # @return [Boolean] true when is a primary partition; false otherwise
        def primary_partition?
          return false unless device.partition_table.extended_possible?

          device.type.is?(:primary)
        end
      end
    end
  end
end
