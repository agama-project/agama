# Copyright (c) [2017-2020] SUSE LLC
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

require "y2storage/storage_enum_wrapper"
require "y2storage/partition_id"

Yast.import "Encoding"

module Y2Storage
  module Filesystems
    # Class to represent all the possible filesystem types
    #
    # This is a wrapper for the Storage::FsType enum
    #
    # FIXME: this class contains several big hashes which triggered Rubocop's
    # ClassLength cop.
    class Type
      include StorageEnumWrapper

      wrap_enum "FsType"

      # See "man mount" for all those options.
      COMMON_FSTAB_OPTIONS = ["async", "atime", "noatime", "user", "nouser",
                              "auto", "noauto", "ro", "rw", "defaults"].freeze
      EXT_FSTAB_OPTIONS = ["dev", "nodev", "usrquota", "grpquota"].freeze
      JOURNAL_OPTIONS = ["data=ordered"].freeze

      # For "iocharset" and "codepage" the value will be added on demand.
      #
      # Not doing it here to avoid always doing complicated locale lookups even
      # if not needed because in many cases no such filesystem is used.
      IOCHARSET_OPTIONS = ["iocharset="].freeze
      CODEPAGE_OPTIONS = ["codepage="].freeze

      # The default system values are in principle visible in
      #
      # /proc/config.gz::CONFIG_FAT_DEFAULT_IOCHARSET
      # /proc/config.gz::CONFIG_FAT_DEFAULT_CODEPAGE
      #
      # but it's always iso8859-1 & 437 anyway.
      #
      DEFAULT_IOCHARSET = "iso8859-1".freeze
      DEFAULT_CODEPAGE = "437".freeze

      # Base for valid characters (as a string): "ABC...XYZabc...xyz012..89"
      ALPHANUM = ["A".."Z", "a".."z", "0".."9"].flat_map(&:to_a).join.freeze

      # Fallback for valid characters for a volume label
      LABEL_VALID_CHARS = ALPHANUM + "-_."

      # Hash with the properties of several filesystem types.
      #
      # Keys are the symbols representing the types and values are hashes that
      # can contain:
      # - `:name` for human string
      # - `:fstab_options` for a list of supported /etc/fstab options
      # - `:default_fstab_options` for the default /etc/fstab options
      #   (do not include "defaults" here!)
      # - `:default_partition_id` for the partition id that fits better with
      #   the corresponding filesystem type.
      # - `:label_valid_chars` (optional) for a string (not a regexp!) containing
      #   the valid characters for the filesystem label. Fallback: LABEL_VALID_CHARS
      #
      # Not all combinations of filesystem types and properties are represented,
      # default values are used for missing information.
      PROPERTIES = {
        btrfs:     {
          fstab_options: COMMON_FSTAB_OPTIONS,
          name:          "Btrfs"
        },
        ext2:      {
          fstab_options: COMMON_FSTAB_OPTIONS + EXT_FSTAB_OPTIONS,
          name:          "Ext2"
        },
        ext3:      {
          fstab_options:         COMMON_FSTAB_OPTIONS + EXT_FSTAB_OPTIONS + ["data="],
          default_fstab_options: JOURNAL_OPTIONS,
          name:                  "Ext3"
        },
        ext4:      {
          fstab_options:         COMMON_FSTAB_OPTIONS + EXT_FSTAB_OPTIONS + ["data="],
          default_fstab_options: JOURNAL_OPTIONS,
          name:                  "Ext4"
        },
        hfs:       {
          name: "MacHFS"
        },
        hfsplus:   {
          name: "MacHFS+"
        },
        jfs:       {
          name: "JFS"
        },
        nfs:       {
          name: "NFS"
        },
        nfs4:      {
          name: "NFS4"
        },
        nilfs2:    {
          name: "NilFS"
        },
        ntfs:      {
          default_fstab_options: ["fmask=133", "dmask=022"],
          name:                  "NTFS"
        },
        reiserfs:  {
          name: "ReiserFS"
        },
        swap:      {
          fstab_options:        ["pri="],
          default_partition_id: PartitionId::SWAP,
          name:                 "Swap"
        },
        tmpfs:     {
          fstab_options: COMMON_FSTAB_OPTIONS + ["size=", "nr_blocks="],
          name:          "Tmpfs"
        },
        vfat:      {
          fstab_options:         COMMON_FSTAB_OPTIONS + ["dev", "nodev", "iocharset=", "codepage="],
          default_fstab_options: IOCHARSET_OPTIONS + CODEPAGE_OPTIONS,
          default_partition_id:  PartitionId::DOS32,
          name:                  "FAT"
        },
        xfs:       {
          fstab_options: COMMON_FSTAB_OPTIONS + ["usrquota", "grpquota"],
          name:          "XFS"
        },
        iso9660:   {
          name: "ISO9660"
        },
        udf:       {
          name: "UDF"
        },
        bitlocker: {
          name: "BitLocker"
        }
      }

      # Typical encodings for some languages used in a non-utf8 8 bit locale
      # environment. This is mostly relevant for FAT filesystems.
      LANG_ENCODINGS = {
        "el" => "iso8859-7",
        "hu" => "iso8859-2",
        "cs" => "iso8859-2",
        "hr" => "iso8859-2",
        "sl" => "iso8859-2",
        "sk" => "iso8859-2",
        "en" => "iso8859-1",
        "tr" => "iso8859-9",
        "lt" => "iso8859-13",
        "bg" => "iso8859-5",
        "ru" => "iso8859-5"
      }.freeze

      ROOT_FILESYSTEMS = [:ext2, :ext3, :ext4, :btrfs, :xfs]

      HOME_FILESYSTEMS = [:ext2, :ext3, :ext4, :btrfs, :xfs]

      LEGACY_ROOT_FILESYSTEMS = [:reiserfs]

      LEGACY_HOME_FILESYSTEMS = [:reiserfs]

      ZIPL_FILESYSTEMS = [:ext2, :ext3, :ext4, :xfs]

      # filesystems that can embed grub
      GRUB_FILESYSTEMS = [:ext2, :ext3, :ext4, :btrfs]

      WINDOWS_FILESYSTEMS = [:ntfs, :vfat, :bitlocker]

      private_constant :PROPERTIES, :ROOT_FILESYSTEMS, :HOME_FILESYSTEMS,
        :COMMON_FSTAB_OPTIONS, :EXT_FSTAB_OPTIONS, :LEGACY_ROOT_FILESYSTEMS,
        :LEGACY_HOME_FILESYSTEMS, :ZIPL_FILESYSTEMS, :JOURNAL_OPTIONS,
        :IOCHARSET_OPTIONS, :CODEPAGE_OPTIONS, :LANG_ENCODINGS

      # Allowed filesystems for root
      #
      # @return [Array<Filesystems::Type>]
      def self.root_filesystems
        ROOT_FILESYSTEMS.map { |f| find(f) }
      end

      # Legacy filesystems allowed for root
      #
      # @return [Array<Filesystems::Type>]
      def self.legacy_root_filesystems
        LEGACY_ROOT_FILESYSTEMS.map { |f| find(f) }
      end

      # Allowed filesystems for home
      #
      # @return [Array<Filesystems::Type>]
      def self.home_filesystems
        HOME_FILESYSTEMS.map { |f| find(f) }
      end

      # Legacy filesystems allowed for home
      #
      # @return [Array<Filesystems::Type>]
      def self.legacy_home_filesystems
        LEGACY_HOME_FILESYSTEMS.map { |f| find(f) }
      end

      # Allowed filesystems for zipl boot partition
      #
      # EXT2 is the preferred type used by default when the proposal
      # proposes a new zipl partition.
      #
      # @note See page 13 in following link
      #   https://share.confex.com/share/123/webprogram/Handout/\
      #   Session15694/SHARE_Bootloader_Ihno_PittsPPT_0.09.pdf
      #
      # @return [Array<Filesystems::Type>]
      def self.zipl_filesystems
        ZIPL_FILESYSTEMS.map { |f| find(f) }
      end

      # Allowed filesystems to embed grub
      #
      # @return [Array<Filesystems::Type>]
      def self.grub_filesystems
        GRUB_FILESYSTEMS.map { |f| find(f) }
      end

      # Allowed filesystems for Windows
      #
      # @return [Array<Filesystems::Type>]
      def self.windows_filesystems
        WINDOWS_FILESYSTEMS.map { |f| find(f) }
      end

      # Check if filesystem is usable as root (mountpoint "/") filesystem.
      #
      # @return [Boolean]
      #
      # @example
      #   devicegraph.filesystems.each do |fs|
      #     puts "#{fs.type}: #{fs.type.root_ok?}"
      #   end
      def root_ok?
        Type.root_filesystems.include?(self)
      end

      # Check if filesystem was usable as root (mountpoint "/") filesystem.
      #
      # @return [Boolean]
      #
      # @example
      #   devicegraph.filesystems.each do |fs|
      #     puts "#{fs.type}: #{fs.type.legacy_root?}"
      #   end
      #
      def legacy_root?
        Type.legacy_root_filesystems.include?(self)
      end

      # Check if filesystem is usable as home (mountpoint "/home") filesystem.
      #
      # @return [Boolean]
      #
      # @example
      #   devicegraph.filesystems.each do |fs|
      #     puts "#{fs.type}: #{fs.type.home_ok?}"
      #   end
      #
      def home_ok?
        Type.home_filesystems.include?(self)
      end

      # Checks whether this type is usable for /home/zipl, i.e. whether the
      # filesytem type is recognized by the s390 firmware.
      #
      # @return [Boolean]
      def zipl_ok?
        Type.zipl_filesystems.include?(self)
      end

      # Checks whether this type is usable to embed grub.
      #
      # @return [Boolean]
      def grub_ok?
        Type.grub_filesystems.include?(self)
      end

      # Check if filesystem was usable as home (mountpoint "/home") filesystem.
      #
      # @return [Boolean]
      #
      # @example
      #   devicegraph.filesystems.each do |fs|
      #     puts "#{fs.type}: #{fs.type.legacy_home?}"
      #   end
      #
      def legacy_home?
        Type.legacy_home_filesystems.include?(self)
      end

      # Whether is usable for installing a Windows system.
      #
      # @return [Boolean]
      def windows_ok?
        Type.windows_filesystems.include?(self)
      end

      # Human readable text for a filesystem
      #
      # @return [String]
      def to_human_string
        default = to_s
        properties = PROPERTIES[to_sym]
        return default unless properties

        properties[:name] || default
      end

      # for backward compatibility
      # @method to_human
      #   @deprecated use to_human_string instead
      alias_method :to_human, :to_human_string

      # Supported fstab options for filesystems of this type
      #
      # @return [Array<String>]
      def supported_fstab_options
        properties = PROPERTIES[to_sym]
        default = []
        return default unless properties

        properties[:fstab_options] || default
      end

      # Default fstab options for filesystems of this type. These are used if
      # the user does not explicitly select anything else in the partitioner
      # for this filesystem.
      #
      # Notice that this will never include "defaults" which is only a
      # placeholder for that field in /etc/fstab if there are no options. The
      # EtcFstab class will handle that on its own. It also does not make any
      # sense to include "defaults" if any other option is present.
      #
      # If a mount path is specified, special handling is applied for some
      # paths ("/", "/boot*").
      #
      # @param mount_path [String] (optional) path where this filesystem will be mounted
      #
      # @return [Array<String>]
      def default_fstab_options(mount_path = nil)
        properties = PROPERTIES[to_sym]
        fallback = []
        return fallback unless properties

        opt = properties[:default_fstab_options] || fallback
        opt = patch_codepage(opt)
        opt = patch_iocharset(opt)
        special_path_fstab_options(opt, mount_path)
      end

      alias_method :default_mount_options, :default_fstab_options

      # Modify mount options based on some special paths.
      #
      # @param opt [Array<String>] mount options
      # @param mount_path [String] path where this filesystem will be mounted
      #
      # @return [Array<String>] changed fstab options
      #
      def special_path_fstab_options(opt, mount_path = nil)
        if mount_path == "/"
          root_fstab_options(opt)
        elsif mount_path == "/boot" || mount_path&.start_with?("/boot/")
          boot_fstab_options(opt)
        else
          opt
        end
      end

      # Modify fstab options for the root filesystem.
      #
      # @param opt [Array<String>] fstab options
      # @return [Array<String>] changed fstab options
      #
      def root_fstab_options(opt)
        case to_sym
        when :ext3, :ext4
          # journal options tend to break remounting root rw (bsc#1077859)
          opt.reject { |o| o.start_with?("data=") }
        else
          opt
        end
      end

      # Modify fstab options for /boot*
      #
      # @param opt [Array<String>] fstab options
      # @return [Array<String>] changed fstab options
      #
      def boot_fstab_options(opt)
        case to_sym
        when :vfat
          # "iocharset=utf8" breaks VFAT case insensitivity (bsc#1080731)
          ret = opt.reject { |o| o == "iocharset=utf8" }
          # Protecting vfat partitions in order to reduce security risks
          # (bsc#1250510).
          ret += ["dmask=0077"] unless ret.find_index { |x| x.start_with?("dmask=") }
          ret
        else
          opt
        end
      end

      # Best fitting partition id for this filesystem type
      #
      # @note: Take into account that the default partition id can be inappropriate for some
      #   partition tables. Consider using {PartitionTables::Base#partition_id_for} to translate
      #   the result to a supported id before assigning it to a partition.
      #
      # @return [PartitionId]
      def default_partition_id
        properties = PROPERTIES[to_sym]
        default = PartitionId::LINUX
        return default unless properties

        properties[:default_partition_id] || default
      end

      # Valid characters for labels for this filesystem type
      #
      # @return [String]
      def label_valid_chars
        properties = PROPERTIES[to_sym]
        default = LABEL_VALID_CHARS
        return default unless properties

        properties[:label_valid_chars] || default
      end

      # Add the required codepage number according to the current locale to
      # fstab options if it contains a codepage specification.
      #
      # @param fstab_options [Array<String>]
      # @return [Array<String>] changed fstab options
      #
      def patch_codepage(fstab_options)
        fstab_options.map do |opt|
          next opt unless opt.start_with?("codepage")

          cp = codepage
          if cp == DEFAULT_CODEPAGE # Default according to "man mount"
            nil
          else
            "codepage=" + cp
          end
        end.compact
      end

      # Add the required iocharset value according to the current locale to
      # fstab options if it contains a iocharset specification.
      #
      # @param fstab_options [Array<String>]
      # @return [Array<String>] changed fstab options
      #
      def patch_iocharset(fstab_options)
        fstab_options.map do |opt|
          next opt unless opt.start_with?("iocharset")

          iocharset = lang_typical_encoding

          case iocharset
          when DEFAULT_IOCHARSET
            nil
          when "utf8"
            # Avoid iocharset=utf8 since that makes the mount case-sensitve as a side effect.
            # Instead, use the separate utf8 option.
            #
            # See doc/vfat-notes.md for some background.
            iocharset
          else
            "iocharset=" + iocharset
          end
        end.compact
      end

      # Return the codepage for FAT filesystems. This is used to convert
      # between long filenames and their short (8+3) equivalent.
      #
      # See also "man mount".
      #
      # @return [String]
      #
      def codepage
        encoding = lang_typical_encoding
        cp = Yast::Encoding.GetCodePage(encoding)
        cp.empty? ? DEFAULT_CODEPAGE : cp
      end

      # Get the encoding that is typical for the current language environment
      # as stored in the Encoding module (where it can be set by the
      # installation workflow). In most cases, this is "utf8". Older FAT
      # filesystems might still use one of the legacy encodings (iso8859-x).
      #
      # @return [String]
      #
      def lang_typical_encoding
        return "utf8" if Yast::Encoding.GetUtf8Lang

        lang = Yast::Encoding.GetEncLang # e.g. "de_DE.iso8859-15"
        lang = lang.downcase[0, 2] # need only the language part
        LANG_ENCODINGS[lang] || "iso8859-15"
      end

      alias_method :iocharset, :lang_typical_encoding
    end
  end
end
