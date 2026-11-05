#
# Copyright (c) [2017] SUSE LLC
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

require "y2storage/dasd"

module Y2Storage
  module AutoinstProfile
    # @return [Array<Symbol>] hwinfo keys that can be used as a skip list key
    HWINFO_KEYS = [
      :bios_id,
      :device_file,
      :device_files,
      :device_number,
      :drive_status,
      :driver,
      :driver_modules,
      :hardware_class,
      :model,
      :parent_id,
      :revision,
      :serial_id,
      :sysfs_busid,
      :sysfs_device_link,
      :sysfs_id,
      :unique_id,
      :vendor
    ].freeze

    # @return [Array<Symbol>] list of supported keys (in addition to hwinfo ones)
    KEYS = [
      :size_k,
      :device,
      :name,
      :dasd_format,
      :dasd_type,
      :label,
      :max_primary,
      :max_logical,
      :transport,
      :sector_size,
      :udev_id,
      :udev_path
    ].freeze

    # This class reads information from disks to be used as values when
    # on skip lists. On one hand, the class implements logic to find out
    # the needed values; on the other hand, it can offer a backward compatibility
    # layer.
    #
    # When some undefined method is called (for instance, the `driver` method),
    # it will try to get the required value from the hardware information
    # object which can be accessed through BlkDevice#hwinfo.
    #
    # NOTE: At this point, only a subset of them are implemented. Have a look at
    # `yast2 ayast_probe` to find out which values are supported in the old
    # libstorage.
    #
    # @see BlkDevice#hwinfo
    class SkipListValue
      # @return [Y2Storage::Disk] Disk
      attr_reader :disk
      private :disk

      # Constructor
      #
      # @param disk [Y2Storage::Disk] Disk
      def initialize(disk)
        @disk = disk
      end

      # Size in kilobytes
      #
      # @return [Integer] Size
      def size_k
        # to_i returns the size in bytes
        disk.size.to_i / 1024
      end

      # Device full name
      #
      # @return [String] Full device name
      def device
        disk.name
      end

      # Device name
      #
      # @return [String] Last part of device name (for instance, sdb)
      def name
        disk.basename
      end

      # @return [String,nil] DASD format or nil if not a DASD device
      #   backward compatibility
      def dasd_format
        return nil unless disk.is?(:dasd)

        disk.format.to_s
      end

      # @return [String,nil] DASD type or nil if not a DASD device
      def dasd_type
        return nil unless disk.is?(:dasd)

        disk.type.to_s
      end

      # @return [String] Partition table type ("msdos", "gpt", etc.)
      def label
        return nil if disk.partition_table.nil?

        disk.partition_table.type.to_s
      end

      # @return [Integer] Max number of primery partitions
      def max_primary
        return nil if disk.partition_table.nil?

        disk.partition_table.max_primary
      end

      # @return [Integer] Max number of logical partitions
      def max_logical
        return nil if disk.partition_table.nil?

        disk.partition_table.max_logical
      end

      # @return [String] Disk transport
      def transport
        disk.transport.to_s
      end

      # @return [Integer] Block size
      def sector_size
        disk.region.block_size.to_i
      end

      # @return [Array<String>] Device udev identifiers
      def udev_id
        disk.udev_ids
      end

      # @return [Array<String>] Device udev paths
      def udev_path
        disk.udev_paths
      end

      # Convert disk information to a hash
      #
      # @return [Hash<String,Object>] Supported keys and values for the given device
      def to_hash
        hwinfo_hash = disk.hwinfo.to_h.select { |k, _v| HWINFO_KEYS.include?(k) }
        KEYS.each_with_object(hwinfo_hash) do |key, all|
          value = public_send(key)
          all[key] = value if value
        end
      end

      private

      # Redefine method_missing in order to try to to get additional values from hardware info
      def method_missing(meth, *_args, &_block)
        if disk.hwinfo && HWINFO_KEYS.include?(meth) && disk.hwinfo.respond_to?(meth)
          disk.hwinfo.public_send(meth)
        else
          super
        end
      end

      # Redefine respond_to_missing
      def respond_to_missing?(meth, _include_private = false)
        return true if super

        disk.hwinfo ? disk.hwinfo.respond_to?(meth) : false
      end
    end
  end
end
