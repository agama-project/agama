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

require "y2storage/storage_class_wrapper"

module Y2Storage
  # Information about one entry in crypttab
  #
  # This is a wrapper for Storage::SimpleEtcCrypttabEntry
  class SimpleEtcCrypttabEntry
    include StorageClassWrapper
    wrap_class Storage::SimpleEtcCrypttabEntry

    # @!method name
    #   @return [String] name of the resulting encrypted block device
    storage_forward :name

    # @!method device
    #   @return [String] path to the underlying block device (e.g. "/dev/sda1") or a
    #     specification of a block device via "UUID=" (where the given uuid refers to
    #     the LUKS device)
    storage_forward :device

    # @!method password
    #   @return [String]
    storage_forward :password

    # @!method crypt_options
    #   @return [Array<String>]
    storage_forward :crypt_options

    # Plain device for the crypttab entry
    #
    # @note It always returns the underlying block device, even when the encryption
    #   device is indicated by its UUID (which refers to the LUKS device).
    #
    # @param devicegraph [Devicegraph]
    # @return [BlkDevice, nil] nil if the device is not found
    def find_device(devicegraph)
      device = devicegraph.encryptions.find { |e| e.match_crypttab_spec?(self.device) }
      device ||= devicegraph.find_by_any_name(self.device)

      device&.is?(:encryption) ? device.blk_device : device
    end
  end
end
