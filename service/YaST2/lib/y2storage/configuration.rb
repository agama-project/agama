# Copyright (c) [2019] SUSE LLC
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

require "y2storage/sysconfig_storage"

module Y2Storage
  # Class to manage the storage settings
  class Configuration
    # Constructor
    #
    # @param storage [Storage::Storage] see {#storage}
    def initialize(storage)
      @storage = storage
    end

    # Default value for mount_by option
    #
    # Initialized via {#apply_defaults}.
    #
    # @return [Filesystems::MountByType]
    def default_mount_by
      Filesystems::MountByType.new(storage.default_mount_by)
    end

    # Sets the default mount_by value
    #
    # @param mount_by [Filesystems::MountByType]
    def default_mount_by=(mount_by)
      storage.default_mount_by = mount_by.to_storage_value
    end

    # Sets default values for the Storage object based on the
    # value from {SysconfigStorage}.
    #
    # @see SysconfigStorage
    def apply_defaults
      self.default_mount_by = SysconfigStorage.instance.default_mount_by
    end

    # Updates sysconfig values
    def update_sysconfig
      SysconfigStorage.instance.default_mount_by = default_mount_by
    end

    private

    # Libstorage object
    #
    # @return [Storage::Storage]
    attr_reader :storage
  end
end
