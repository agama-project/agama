# Copyright (c) [2018-2020] SUSE LLC
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
require "singleton"
require "y2storage/filesystems/mount_by_type"

module Y2Storage
  # Class to read and write /etc/sysconfig/storage file
  #
  # The class is basically a simply wrapper for the SCR. The class does not
  # remember any values.
  #
  # @example Read raw value for key DEVICE_NAMES
  #   sysconfig = SysconfigStorage.instance
  #   sysconfig.device_names #=> "uuid"
  #
  # @example Get MountByType object
  #   sysconfig = SysconfigStorage.instance
  #   sysconfig.default_mount_by #=> Y2Storage::Filesystems::MountByTye::UUID
  #
  # @example Write raw value for key DEVICE_NAMES
  #   sysconfig = SysconfigStorage.instance
  #   sysconfig.device_names = "label"
  #
  # @example Write value from a MountByType object
  #   sysconfig = SysconfigStorage.instance
  #   sysconfig.default_mount_by = Y2Storage::Filesystems::MountByTye::LABEL
  class SysconfigStorage
    include Singleton
    include Yast
    include Yast::Logger

    # Reads value for DEVICE_NAME key and converts it to a proper MountByType object
    #
    # @note In case the value cannot be converted, a fallback value is used,
    #   see {MOUNT_BY_FALLBACK}.
    #
    # @return [Y2Storage::Filesystems::MountByType]
    def default_mount_by
      Y2Storage::Filesystems::MountByType.find(device_names)
    rescue NameError
      log.warn("sysconfig.storage contains an invalid value for DEVICE_NAMES: #{device_names}. " \
               "Using fallback value #{MOUNT_BY_FALLBACK}")
      Y2Storage::Filesystems::MountByType.find(MOUNT_BY_FALLBACK)
    end

    # Writes the proper DEVICE_NAMES value into the sysconfig file
    #
    # @note The MountByType object is converted to a plain string.
    #
    # @param mount_by [Y2Storage::Filesystems::MountByType]
    def default_mount_by=(mount_by)
      self.device_names = mount_by.to_s
    end

    # Reads the raw value for the DEVICE_NAMES key
    #
    # @return [String, nil] nil if there is no value for DEVICE_NAMES
    def device_names
      read(DEVICE_NAMES)
    end

    # Writes the value for the DEVICE_NAMES key
    #
    # @param value [String]
    def device_names=(value)
      write(DEVICE_NAMES, value)
    end

    # Writes the value for the USED_FS_LIST key
    #
    # @param value [String]
    def used_fs_list=(value)
      write(USED_FS_LIST, value)
    end

    private

    SYSCONFIG_PATH = ".sysconfig.storage".freeze

    DEVICE_NAMES = "DEVICE_NAMES".freeze
    USED_FS_LIST = "USED_FS_LIST".freeze

    MOUNT_BY_FALLBACK = :uuid

    # Reads a key from the sysconfig file
    #
    # @param key [String]
    # @return [String, nil]
    def read(key)
      Yast::SCR.Read(path("#{SYSCONFIG_PATH}.#{key}"))
    end

    # Writes a value into the sysconfig file
    #
    # @param key [String]
    # @param value [String]
    def write(key, value)
      Yast::SCR.Write(path("#{SYSCONFIG_PATH}.#{key}"), value)
      Yast::SCR.Write(path(SYSCONFIG_PATH), nil)
    end
  end
end
