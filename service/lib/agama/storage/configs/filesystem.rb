# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "pathname"

module Agama
  module Storage
    module Configs
      class Filesystem
        # @return [Pathname] Object that represents the root path
        ROOT_PATH = Pathname.new("/").freeze

        attr_accessor :path
        # @return [Configs::FilesystemType]
        attr_accessor :type
        attr_accessor :label
        attr_accessor :mkfs_options
        attr_accessor :mount_options
        attr_accessor :mount_by

        def initialize
          @mount_options = []
          @mkfs = []
        end

        # Whether the given path is equivalent to {#path}
        #
        # This method is more robust than a simple string comparison, since it takes
        # into account trailing slashes and similar potential problems.
        #
        # @param other_path [String, Pathname]
        # @return [Boolean]
        def path?(other_path)
          return false unless path

          Pathname.new(other_path).cleanpath == Pathname.new(path).cleanpath
        end

        # Whether the mount point is root
        # @return [Boolean]
        def root?
          path?(ROOT_PATH)
        end

        def btrfs_snapshots?
          return false unless type&.fs_type&.is?(:btrfs)

          type.btrfs&.snapshots?
        end
      end
    end
  end
end
