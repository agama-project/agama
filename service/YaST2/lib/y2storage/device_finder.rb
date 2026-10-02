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

require "pathname"
require "y2storage/storage_manager"
require "y2storage/blk_device"
require "y2storage/storage_env"

module Y2Storage
  # Utility class to find devices in a devicegraph
  class DeviceFinder
    include Yast::Logger

    # Constructor
    #
    # @param devicegraph [Devicegraph] see {#devicegraph}
    def initialize(devicegraph)
      @devicegraph = devicegraph
    end

    # Find device with given name e.g. /dev/sda3
    #
    # In case of LUKSes and MDs, the device might be found by using an alternative name,
    # see {#alternative_names}.
    #
    # @param name [String]
    # @param with_alternatives [Boolean] whether to try the search with possible alternative names
    # @return [Device, nil] device matching the name, nil if no device was found
    def find_by_name(name, with_alternatives)
      names = all_names(name, with_alternatives)

      device = call_finder(:name, names)
      return device if device

      log.info "Device #{name} not found by name"
      nil
    end

    # Finds a device by any name including any symbolic link in the /dev directory
    #
    # This is different from {BlkDevice.find_by_any_name} in several ways:
    #
    # * It will find any matching device, not only block devices (e.g. LVM VGs
    #   also have a name but are not block devices).
    # * It can be called on any devicegraph, not only probed.
    # * It uses a system lookup only when necessary (i.e. all the cheaper
    #   methods for finding the device have been unsuccessful).
    # * It avoids system lookup in potentially risky scenarios (like an outdated
    #   {StorageManager#probed} or when running in test mode).
    #
    # In case of LUKSes and MDs, the device might be found by using an alternative name,
    # see {#alternative_names}.
    #
    # @param name [String] can be a kernel name like "/dev/sda1" or any symbolic
    #   link below the /dev directory
    # @param with_alternatives [Boolean] whether to try the search with possible alternative names
    # @return [Device, nil] device matching the name, nil if no device was found
    def find_by_any_name(name, with_alternatives)
      names = all_names(name, with_alternatives)

      device = call_finder(:all_names, names)
      return device if device

      # If no device yet, there is still a chance using the slower
      # BlkDevice.find_by_any_name. Unfortunatelly this only works in the
      # probed devicegraph by design. Moreover it can only be safely called
      # under certain circumstances.
      if !udev_lookup_possible?
        log.info "System lookup cannot be used to find #{name}"
        return nil
      end

      device = call_finder(:system_lookup, names)
      return device if device

      log.info "Device #{name} not found via system lookup"
      nil
    end

    private

    # Devicegraph in which the searchs must be performed
    # @return [Devicegraph]
    attr_reader :devicegraph

    # Auxiliary method to calculate all the alternatives for the given name, if
    # needed
    #
    # @param name [String] original name to be searched
    # @param with_alternatives [Boolean] whether to include alternative names in
    #   the search to be performed
    # @return [Array<String>] the original name followed by all the alternative
    #   names that must be taken into account
    def all_names(name, with_alternatives)
      all = [name]
      all.concat(alternative_names(name)) if with_alternatives
      all
    end

    # Auxiliary method to call a given finder in a list of names, returning the
    # first found device
    #
    # @param finder [Symbol, String] name of the finder
    # @param names [Array<String>] names of device to search for
    # @return [Device, nil] device matching any of the names, nil if no device was found
    def call_finder(finder, names)
      names.each do |name|
        device = send(:"#{finder}_finder", name)
        if device
          log.debug "Device #{names.first} found as #{name} by finder #{finder}: #{device.inspect}"
          return device
        end
      end

      nil
    end

    # Finder method: performs the search of a device based on its #name method
    #
    # @see #call_finder
    #
    # @return [Device, nil] device matching the name, nil if no device was found
    def name_finder(name)
      BlkDevice.find_by_name(devicegraph, name) || devicegraph.lvm_vgs.find { |vg| vg.name == name }
    end

    # Finder method: performs the search of a device by any of its device names (kernel name or
    # udev name) already present in the devicegraph
    #
    # @see #call_finder
    #
    # @return [Device, nil] device matching the name, nil if no device was found
    def all_names_finder(name)
      # First check using the device name
      device = name_finder(name)
      # If not found, check udev names directly handled by libstorage-ng
      device ||= devicegraph.blk_devices.find { |dev| dev.udev_full_all.include?(name) }

      device
    end

    # Finder method: performs a system lookup to find a device matching the given name
    #
    # @see BlkDevice.find_by_any_name
    # @see #call_finder
    #
    # @return [Device, nil] device matching the name, nil if no device was found
    def system_lookup_finder(name)
      probed = StorageManager.instance.raw_probed
      device = BlkDevice.find_by_any_name(probed, name)

      return nil if device.nil?

      devicegraph.find_device(device.sid)
    end

    # Whether it's reasonably safe to use BlkDevice.find_by_any_name
    #
    # @return [Boolean]
    def udev_lookup_possible?
      return false if StorageEnv.instance.test_mode?

      # Checking when the operation is safe is quite tricky, since we must
      # ensure than the list of block devices in #probed matches 1:1 the list
      # of block devices in the system.
      #
      # Although it's not 100% precise, checking whether commit has not been
      # called provides a seasonable result.
      !StorageManager.instance.committed?
    end

    # Alternative versions of the name to be also considered in searches
    #
    # @param device_name [String] a kernel name, udev name or any other device name
    # @return [Array<String>]
    def alternative_names(device_name)
      alternative_enc_names(device_name) + alternative_md_names(device_name)
    end

    # Alternative names for encryption devices
    #
    # @see #alternative_names
    #
    # Encryption devices might be probed with a name that does not match the device name
    # indicated in the fstab file. For example, /etc/fstab could have an entry like:
    #
    #   /dev/mapper/cr_home   /home   ext4  defaults  0   0
    #
    # But that encryption device could be probed with a name like /dev/mapper/cr-auto-1. In that
    # case, the device could not be found in the devicegraph when searching for the device name in the
    # fstab entry. But, if the crypttab file was previously parsed (see Crypttab#save_encryption_names),
    # the Encryption devices are populated in the devicegraph with their corresponding name indicated
    # in the crypttab. This information can be used to try possible alternative names for the encryption
    # device. For example, when the devicegraph contains a Encryption layer /dev/mapper/cr-auto-1 over
    # the device /dev/sda1, and the /etc/crypttab has the following entry:
    #
    #   cr_home   /dev/sda1
    #
    # a possible alternative name for /dev/mapper/cr_home would be /dev/mapper/cr-auto-1, due to the
    # encryption device cr-auto-1 has "cr_home" as crypttab_name (after parsing the crypttab file).
    #
    # @param device_name [String] a kernel name or udev name
    # @return [Array<String>]
    def alternative_enc_names(device_name)
      devices = devicegraph.encryptions.select do |enc|
        enc.crypttab_name? && device_name.include?(enc.crypttab_name)
      end

      devices.map { |d| device_name.sub(d.crypttab_name, d.dm_table_name) }
    end

    # Alternative names for MD devices
    #
    # @see #alternative_names
    #
    # @param device_name [String] a kernel name or link to it
    # @return [Array<String>]
    def alternative_md_names(device_name)
      case Pathname.new(device_name).cleanpath.to_s
      when /^\/dev\/md(\d+)$/
        ["/dev/md/#{Regexp.last_match(1)}"]
      when /^\/dev\/md\/(\d+)$/
        ["/dev/md#{Regexp.last_match(1)}"]
      else
        []
      end
    end
  end
end
