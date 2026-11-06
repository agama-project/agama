# Copyright (c) [2018-2019] SUSE LLC
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
require "storage"
require "y2storage/simple_etc_crypttab_entry"
require "y2storage/encryption_method"

module Y2Storage
  # Class to represent a crypttab file
  class Crypttab
    include Yast::Logger

    CRYPTTAB_PATH = "/etc/crypttab"
    private_constant :CRYPTTAB_PATH

    # @return [Filesystems::Base] filesystem to which the crypttab file belongs to
    attr_reader :filesystem

    # @return [Array<SimpleEtcCrypttabEntry>]
    attr_reader :entries

    # Constructor
    #
    # @param path [String] path to crypttab file
    # @param filesystem [Filesystems::Base]
    def initialize(path = CRYPTTAB_PATH, filesystem = nil)
      @path = path
      @filesystem = filesystem
      @entries = read_entries
    end

    # Saves encryption names indicated in the crypttab file
    #
    # For each entry in the crypttab file, it finds the corresponding device and updates
    # its crypttab name with the value indicated in its crypttab entry. The device is
    # not modified at all if it is not encrypted.
    #
    # @param devicegraph [Devicegraph]
    def save_encryption_names(devicegraph)
      entries.each { |e| save_encryption_name(devicegraph, e) }
    end

    private

    # @return [String] crypttab file path
    attr_reader :path

    # Reads a crypttab file and returns its entries
    #
    # @return [Array<SimpleEtcCrypttabEntry>]
    def read_entries
      entries = Storage.read_simple_etc_crypttab(path)
      entries.map { |e| SimpleEtcCrypttabEntry.new(e) }
    rescue Storage::Exception
      log.error("Not possible to read the crypttab file: #{path}")
      []
    end

    # Saves the crypttab name according to the value indicated in a crypttab entry
    #
    # Generally, when a crypttab entry points to a luks device, the encryption layer is probed. But in
    # case of plain encrypted devices, the encryption layer could not exist in the probed devicegraph.
    # Note that no headers are written into the device when using plain encryption. And, for this
    # reason, plain encryption devices are only probed for the root filesystem by parsing its crypttab.
    #
    # Due to plain encryption devices could be not probed, this method creates the plain encryption
    # layer to be able to save the encryption name indicated in the crypttab entry.
    #
    # @param devicegraph [Devicegraph]
    # @param entry [SimpleEtcCrypttabEntry]
    def save_encryption_name(devicegraph, entry)
      device = entry.find_device(devicegraph)

      return unless device

      if create_swap_encryption_for_entry?(device, entry)
        device.remove_descendants
        device.encrypt(dm_name: entry.name, method: encryption_method_for_entry(entry))
      elsif device.encrypted?
        device.encryption.crypttab_name = entry.name
      end
    end

    # Whether the encryption layer should be created for a swap device according to the given crypttab
    # entry
    #
    # @param device [BlkDevice]
    # @param entry [SimpleEtcCrypttabEntry]
    #
    # @return [Boolean]
    def create_swap_encryption_for_entry?(device, entry)
      encryption_method = encryption_method_for_entry(entry)

      return false unless detectable_by_crypttab?(encryption_method)

      encrypt_with_encryption_method?(device, encryption_method)
    end

    # Whether the given encryption method corresponds to an encryption method that might be recoginzed by
    # reading the crypttab file (it could be not probed). This could happens when using plain encryption
    # technology.
    #
    # @param encryption_method [EncryptionMethod, nil]
    #
    # @return [Boolean]
    def detectable_by_crypttab?(encryption_method)
      return false unless encryption_method

      encryption_method.only_for_swap?
    end

    # Whether the given encryption method can be used to encrypt the given device
    #
    # The encryption method can be used when the device is not encrypted yet with the given encryption
    # method and the encryption method is currently available.
    #
    # @param device [BlkDevice]
    # @param encryption_method [EncryptionMethod]
    #
    # @return [Boolean]
    def encrypt_with_encryption_method?(device, encryption_method)
      return false unless encryption_method.available?

      !device.encrypted? || !device.encryption.method.is?(encryption_method)
    end

    # Encryption method used for the given crypttab entry
    #
    # @param entry [SimpleEtcCrypttabEntry]
    # @return [EncryptionMethod, nil] nil if encryption method cannot be inferred
    def encryption_method_for_entry(entry)
      EncryptionMethod.for_crypttab(entry)
    end
  end
end
