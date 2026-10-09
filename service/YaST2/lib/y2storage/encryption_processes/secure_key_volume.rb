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

module Y2Storage
  module EncryptionProcesses
    # Each instance of this class represents one of the entries in the "volumes"
    # section of a secure AES key
    #
    # @see SecureKey
    class SecureKeyVolume
      # @return [String] name of the plain device
      attr_reader :plain_name

      # @return [String] DeviceMapper name of the encrypted device
      attr_reader :dm_name

      # Constructor
      #
      # @param plain_name [String] see #plain_name
      # @param dm_name [String] see #dm_name
      def initialize(plain_name, dm_name)
        @plain_name = plain_name
        @dm_name = dm_name
      end

      # Creates a new object based on the portion of the output of
      # "zkey list" that represents a concrete volume entry
      #
      # The input string can be something like "/dev/sda1" or
      # "/dev/sda1:cr_sda1".
      #
      # @param string [String] name of the plain device and, optionally, also
      #   DeviceMapper of the encrypted device
      # @return [SecureKeyVolume]
      def self.new_from_str(string)
        plain, dm = string.split(":")
        new(plain, dm)
      end

      # Creates a new object referencing the given encryption device
      #
      # @param device [Encryption]
      # @return [SecureKeyVolume]
      def self.new_from_encryption(device)
        plain_name = device.blk_device.udev_full_ids.first || device.blk_device.name
        new(plain_name, device.dm_table_name)
      end

      # String representation of the volume entry, using the same format than
      # "zkey list"
      #
      # @return [String]
      def to_s
        dm_name ? "#{plain_name}:#{dm_name}" : plain_name
      end

      # Whether the volume entry references the given device
      #
      # @param device [BlkDevice, Encryption] it can be the plain device being
      #   encrypted or the resulting encryption device
      # @return [Boolean]
      def match_device?(device)
        if device.is?(:encryption)
          device.dm_table_name == dm_name
        else
          blk_device_names(device).include?(plain_name)
        end
      end

      private

      # @see #match_device?
      def blk_device_names(device)
        [device.name] + device.udev_full_ids + device.udev_full_paths
      end
    end
  end
end
