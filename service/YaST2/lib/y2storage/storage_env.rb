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

module Y2Storage
  # Class to read ENV values for storage
  class StorageEnv
    include Singleton
    include Yast::Logger

    ENV_MULTIPATH = "LIBSTORAGE_MULTIPATH_AUTOSTART".freeze

    ENV_BIOS_RAID = "LIBSTORAGE_MDPART".freeze

    ENV_ACTIVATE_LUKS = "YAST_ACTIVATE_LUKS".freeze

    ENV_LIBSTORAGE_IGNORE_PROBE_ERRORS = "LIBSTORAGE_IGNORE_PROBE_ERRORS".freeze

    ENV_REUSE_LVM = "YAST_REUSE_LVM".freeze

    ENV_NO_BLS_BOOT = "YAST_NO_BLS_BOOT".freeze

    ENV_TEST_MODE = "YAST_STORAGE_TEST_MODE".freeze

    ENV_DEVICEGRAPH = "YAST_DEVICEGRAPH_FILE".freeze

    private_constant :ENV_MULTIPATH, :ENV_BIOS_RAID, :ENV_ACTIVATE_LUKS
    private_constant :ENV_LIBSTORAGE_IGNORE_PROBE_ERRORS
    private_constant :ENV_REUSE_LVM, :ENV_NO_BLS_BOOT
    private_constant :ENV_TEST_MODE, :ENV_DEVICEGRAPH

    def initialize
      reset_cache
    end

    # Reset the cached values of the environment variables,
    # call this after changing the value of any used environment variable
    def reset_cache
      log.debug "Resetting ENV values cache"
      @active_cache = {}
    end

    # Whether the activation of multipath has been forced via the
    # LIBSTORAGE_MULTIPATH_AUTOSTART boot parameter
    #
    # See https://en.opensuse.org/SDB:Linuxrc for details and see
    # bsc#1082542 for an example of scenario in which this is needed.
    #
    # @return [Boolean]
    def forced_multipath?
      active?(ENV_MULTIPATH)
    end

    # Whether the probed MD RAIDS has been forced to be consider BIOS RAIDS
    # via the LIBSTORAGE_MDPART boot parameter
    #
    # See bsc#1092417 for an example of scenario in which this is needed.
    #
    # @return [Boolean]
    def forced_bios_raid?
      active?(ENV_BIOS_RAID)
    end

    # Whether operations on the system should be avoided, including those for
    # reading
    #
    # This implies creating a test instance of the libstorage-ng manager (instead
    # of a regular one) and also avoiding queries to the system to search for
    # devices or to analyze them.
    #
    # @return [Boolean]
    def test_mode?
      active?(ENV_TEST_MODE)
    end

    # Location of a file (XML or YAML) containing a devicegraph that must be
    # used to mock the libstorage-ng probing.
    #
    # @return [String, nil]
    def devicegraph_file
      filename = read(ENV_DEVICEGRAPH)
      return nil if filename&.strip&.empty?

      filename
    end

    # Whether LUKSes could be activated
    #
    # See bsc#1162545 for why this is needed and was added.
    #
    def activate_luks?
      active?(ENV_ACTIVATE_LUKS, default: true)
    end

    # Whether YaST should reuse existing LVM
    #
    # see jsc#PED-6407 or jsc#IBM-1315
    #
    # @return [Boolean, nil] boolean as explicitly set by user, nil if user set nothing
    def requested_lvm_reuse
      value = read(ENV_REUSE_LVM)

      return nil if !value

      env_str_to_bool(value)
    end

    # Whether YaST should not use bls bootloaders
    #
    # @return [Boolean]
    def no_bls_bootloader
      active?(ENV_NO_BLS_BOOT)
    end

    # Whether errors during libstorage probing should be ignored.
    #
    # See bsc#1177332:
    #
    # Some storage technologies like Veritas Volume Manager use disk labels
    # like "sun" that we don't support in libstorage / storage-ng. Setting the
    # LIBSTORAGE_IGNORE_PROBE_ERRORS env var gives the admin a chance to use
    # the YaST partitioner despite that. Those disks will show up like empty
    # disks and not cause an error pop-up for each one.
    def ignore_probe_errors?
      result = active?(ENV_LIBSTORAGE_IGNORE_PROBE_ERRORS)
      log.info("Ignoring libstorage probe errors") if result
      result
    end

    private

    # Takes a string and translates it to bool in a similar way how linuxrc does
    def env_str_to_bool(value)
      # Similar to what linuxrc does, also consider the flag activated if the
      # variable is used with no value or with "1"
      value.casecmp?("on") || value.empty? || value == "1"
    end

    # Whether the env variable is active
    #
    # @param variable [String]
    # @param default [Boolean] value if env variable is not set
    # @return [Boolean]
    def active?(variable, default: false)
      return @active_cache[variable] if @active_cache.key?(variable)

      value = read(variable)
      result = if value
        env_str_to_bool(value)
      else
        default
      end
      @active_cache[variable] = result
    end

    # Read an ENV variable
    #
    # @param variable [String]
    # @return [String, nil]
    def read(variable)
      # Sort the keys to have a deterministic behavior and to prefer
      # all-uppercase over the other variants, then do a case insensitive
      # search
      key = ENV.keys.sort.find { |k| k.match(/\A#{variable}\z/i) }
      return nil unless key

      value = ENV[key]
      log.debug "Found ENV variable key: #{key.inspect} value: #{value.inspect}"
      value
    end
  end
end
