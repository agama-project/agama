# Copyright (c) [2020] SUSE LLC
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

require "yast/i18n"
require "y2storage/storage_class_wrapper"
require "y2storage/storage_manager"
require "y2storage/filesystems/base"

module Y2Storage
  module Filesystems
    # Class to represent a tmpfs.
    #
    # The Tmpfs object should always have MountPoint as child. So the Tmpfs
    # must be deleted whenever the MountPoint is removed.
    #
    # This is a wrapper for Storage::Tmpfs
    class Tmpfs < Base
      include Yast::I18n

      wrap_class Storage::Tmpfs

      # @!method self.create(devicegraph)
      #   @param devicegraph [Devicegraph]
      #   @return [Tmpfs]
      storage_class_forward :create, as: "Filesystems::Tmpfs"

      # @!method self.all(devicegraph)
      #   @param devicegraph [Devicegraph]
      #   @return [Array<Tmpfs>] all the tmp filesystems in the given devicegraph
      storage_class_forward :all, as: "Filesystems::Tmpfs"

      # Size limit of the filesystem, based on its mount options
      #
      # When there are no mount options related to the size limit, it returns the
      # equivalent for "size=50%", which is the default value documented for tmpfs.
      #
      # @see man tmpfs
      #
      # @return [DiskSize] zero if the size couldn't be determined
      def size
        option = size_mount_option || DEFAULT_SIZE_MOUNT_OPTION
        size =
          case option
          when /^size=(\d+)%/
            size_from_percent(Regexp.last_match(1))
          when /^size=(.*)/
            size_from_value(Regexp.last_match(1))
          when /^nr_blocks=(.*)/
            size_from_blocks(Regexp.last_match(1))
          end

        size || DiskSize.zero
      end

      # Name used to idenfity the device
      #
      # @return [String]
      def name
        # FIXME: wrapper classes should not provide strings to be presented in the UI. Use decorators.
        textdomain "storage"

        # TRANSLATORS: name used to identify a tmpfs filesystem, where %{type} is replaced by the
        #   filesystem type (i.e., Tmpfs) and %{mount_path} is replaced by the tmpfs mount path
        #   (e.g., "/tmp").
        #
        #   Examples: "Tmpfs /tmp"
        format(_("%{type} %{mount_path}"), type: type.to_human_string, mount_path: mount_path)
      end

      protected

      # Name of the mount option used to specify directly the max size of the tmpfs
      #
      # @return [String]
      SIZE_OPT = "size".freeze
      private_constant :SIZE_OPT

      # Name of the mount option used to specify the max number of blocks for the tmpfs
      #
      # @return [String]
      BLOCKS_OPT = "nr_blocks".freeze
      private_constant :BLOCKS_OPT

      # Default value used to limit the size of the tmpfs filesystem if not explicit
      # mount options are given
      #
      # @return [String]
      DEFAULT_SIZE_MOUNT_OPTION = "size=50%".freeze
      private_constant :DEFAULT_SIZE_MOUNT_OPTION

      # @see Device#is?
      def types_for_is
        super << :tmpfs
      end

      # @see #size
      def size_from_value(size_str)
        parse(size_str)&.ceil(page_size)
      end

      # @see #size
      def size_from_blocks(blocks_str)
        blocks = parse(blocks_str)
        return nil unless blocks

        blocks * page_size.to_i
      end

      # @see #size
      def size_from_percent(percent_str)
        percent = percent_str.chomp("%")
        ((ram_size * percent.to_i) / 100).ceil(page_size)
      end

      # Mount option used to define the max size of the temporary filesystem
      #
      # @return [String, nil] nil if there is no mount option regarding size limit
      def size_mount_option
        size_mount_options.last
      end

      # Mount options used to define the max size of the temporary filesystem
      #
      # The max size can be set using the size= or nr_blocks= options, all occurrences of both
      # are included in the returned array, in the order they appear in the list of options.
      #
      # Both can be ommitted, in which case the method returns an empty array.
      #
      # @return [Array<String>]
      def size_mount_options
        return [] unless mount_point

        mount_point.mount_options.grep(/^(#{SIZE_OPT}|#{BLOCKS_OPT})=/)
      end

      # Parses the given size, in the format used by the size= and nr_blocks= mount options
      #
      # @param size_str [String]
      # @return [DiskSize, nil] nil if the string cannot be parsed
      def parse(size_str)
        DiskSize.parse(size_str, legacy_units: true)
      rescue StandardError
        nil
      end

      # Page size of the system
      #
      # @return [DiskSize]
      def page_size
        DiskSize.new(StorageManager.instance.arch.page_size)
      end

      # Size of the system's RAM
      #
      # @return [DiskSize]
      def ram_size
        DiskSize.new(StorageManager.instance.arch.ram_size)
      end
    end
  end
end
