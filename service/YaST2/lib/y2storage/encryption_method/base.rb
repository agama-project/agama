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
  module EncryptionMethod
    # Base class for encryption methods.
    #
    # Encryption method classes offer an API to:
    #
    # * determine whether a encryption method is available in the running system (see
    #   {#available?}),
    # * find out which method was used to encrypt a given device (see {#used_for?}),
    # * encrypt a device. In this case, it relies on {Y2Storage::EncryptionProcesses} classes.
    class Base
      include Yast::I18n

      # Constructor
      #
      # @param id [Symbol]
      # @param label [String]
      def initialize(id, label)
        textdomain "storage"

        @id = id
        @label = label
      end

      # @return [Symbol] name to represent the encryption method (e.g., :luks1, :random_swap)
      attr_reader :id
      alias_method :to_sym, :id

      # Localized label to represent the encryption method
      #
      # @return [String] very likely, a frozen string
      def to_human_string
        _(@label)
      end

      # Compares two encryption methods
      #
      # @param other [Y2Storage::EncryptionMethod]
      # @return [Boolean] true if compared encryption methods have the same class and id; false if not
      def ==(other)
        other.class == self.class && other.id == id
      end

      alias_method :eql?, :==

      # Whether the given value matches with the symbol representation (id) of the
      # encryption method
      #
      # @param value [#to_sym]
      # @return [Boolean]
      def is?(value)
        id == value.to_sym
      end

      # Whether the encryption method was used for the given encryption device
      #
      # @param _encryption [Y2Storage::Encryption]
      # @return [Boolean]
      def used_for?(_encryption)
        false
      end

      # Whether the encryption method was used for the given crypttab entry
      #
      # Note that the encryption process can only be detected when using a swap process (see {Swap}).
      # For other processes (e.g., :luks1) is not possible to infer it by using only the crypttab
      # information.
      #
      # @param _entry [Y2Storage::SimpleEtcCrypttabEntry]
      # @return [Boolean]
      def used_for_crypttab?(_entry)
        false
      end

      # Whether the encryption method can be used in this system
      #
      # @return [Boolean]
      def available?
        true
      end

      # Determines whether a user provided password is required
      #
      # @return [Boolean]
      def password_required?
        true
      end

      # Whether the encryption method is useful only for swap
      #
      # Some encryption methods are mainly useful for encrypting swap disks since they produce a new key
      # on every boot cycle.
      #
      # @return [Boolean]
      def only_for_swap?
        false
      end

      # Creates an encryption device for the given block device
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      # @return [Y2Storage::Encryption]
      def create_device(blk_device, dm_name)
        encryption_process.create_device(blk_device, dm_name)
      end

      # Returns the encryption type to be used
      #
      # @return [Y2Storage::EncryptionType]
      def encryption_type
        encryption_process.encryption_type
      end

      private

      # Returns an instance of the encryption process (e.g. EncryptionProcesses::Luks1)
      #
      # This method is responsible for configuring the process and it is expected to
      # be redefined for each encryption method.
      #
      # @return [EncryptionProcesses::Base]
      def encryption_process
        raise "Undefined encryption process for '#{id}' encryption method"
      end
    end
  end
end
