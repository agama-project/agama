# Copyright (c) [2018] SUSE LLC
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

module Y2Storage
  # Mixin for classes that are usually treated like disks by YaST.
  #
  # @see Devicegraph::disk_devices
  #
  # Includes several methods usually checked by the partitioner, the proposal
  # and other components. This mixin offers a default conservative
  # implementation that can be overridden or extended in any of the classes.
  module DiskDevice
    # Checks whether it's an USB disk
    #
    # @return [Boolean]
    def usb?
      false
    end

    # Checks whether the device is a multipath wire
    #
    # @return [Boolean]
    def multipath_wire?
      descendants.any? { |d| d.is?(:multipath) }
    end

    # Checks whether the device is a disk belonging to a BIOS RAID
    #
    # @return [Boolean]
    def bios_raid_disk?
      descendants.any? { |d| d.is?(:bios_raid) }
    end

    # @see #sd_card?
    SD_CARD_DRIVER = "mmcblk".freeze
    private_constant :SD_CARD_DRIVER

    # Check if this is a MMC (MultiMedia Card) or a SD (Secure Digital) card
    #
    # @return [Boolean]
    def sd_card?
      return false unless respond_to?(:driver)

      driver&.include?(SD_CARD_DRIVER)
    end

    protected

    # @see Device#is?
    def types_for_is
      types = super
      @disk_device = disk_device? if @disk_device.nil?
      types << :disk_device if @disk_device
      types
    end

    # Whether this device can be in general treated like a disk for YaST
    # purposes
    #
    # @see Devicegraph::disk_devices
    #
    # @return [Boolean]
    def disk_device?
      # If we cannot create partitions on it, this doesn't look like a disk
      return false if respond_to?(:usable_as_partitionable?) && !usable_as_partitionable?
      # If this is a zero-size device, we cannot use it
      return false if size.zero?
      # If this is the wire of a multipath, we better don't fiddle with it
      return false if multipath_wire?
      # Same applies if this is part of a BIOS RAID
      return false if bios_raid_disk?

      true
    end
  end
end
