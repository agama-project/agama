# Copyright (c) [2019-2026] SUSE LLC
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
require "y2storage/yast_feature"

require "abstract_method"

module Y2Storage
  module EncryptionProcesses
    # Base class to perform, through an EncryptionMethod, the creation of an encrypted device
    #
    # @note This is a base class. To really created an encrypted device use any
    # of its subclasses, which must defines an #encryption_type.
    class Base
      include Yast::Logger

      # Constructor
      #
      # @param method [Y2Storage::EncryptionMethod]
      def initialize(method)
        @method = method
      end

      # @return [EncryptionMethod] the encryption method using the process
      attr_reader :method

      # Creates an encryption layer over the given block device
      #
      # @param blk_device [Y2Storage::BlkDevice]
      # @param dm_name [String]
      #
      # @return [Encryption]
      def create_device(blk_device, dm_name)
        enc = blk_device.create_encryption(dm_name || "", encryption_type)
        enc.open_options = open_command_options(blk_device)
        enc.crypt_options = crypt_options(blk_device) + enc.crypt_options
        enc.encryption_process = self
        enc
      end

      # Returns the encryption type to be used
      #
      # This method must be defined by derived class.
      #
      # @return [Y2Storage::EncryptionType]
      abstract_method :encryption_type

      # Executes the actions that must be performed right before the devicegraph is
      # committed to the system
      #
      # @param _device [Encryption]
      def pre_commit(_device); end

      # Executes the actions that must be performed after the devicegraph has
      # been committed to the system
      #
      # @param _device [Encryption]
      def post_commit(_device); end

      # Executes the actions that must be performed at the end of the installation,
      # before unmounting the target system
      #
      # @param _device [Encryption]
      def finish_installation(_device); end

      # Open options for the encryption device
      #
      # @param _blk_device [BlkDevice] Block device to encrypt
      # @return [Array<String>]
      def open_options(_blk_device)
        []
      end

      # Crypt options for the encryption device
      #
      # @param _blk_device [BlkDevice] Block device to encrypt
      # @return [Array<String>]
      def crypt_options(_blk_device)
        []
      end

      # Features objects to describe the requirements to perform the commit phase
      # and any subsequent operation (eg., initialization during the first boot) of
      # the encryption procedure
      #
      # @return [Array<YastFeature>]
      def commit_features
        []
      end

      private

      # Open options with the format expected by the underlying tools (cryptsetup)
      #
      # @param blk_device [BlkDevice] Block device to encrypt
      # @return [String]
      def open_command_options(blk_device)
        open_options(blk_device).join(" ")
      end

      IDEAL_SECTOR_SIZE = 4096

      # Sector size for a given device
      #
      # For performance reasons, it tries to use 4k when possible. Otherwise, it returns
      # nil so the default is used.
      #
      # @param blk_device [BlkDevice] Block device to encrypt
      # @return [Integer,nil]
      def sector_size_for(blk_device)
        return IDEAL_SECTOR_SIZE if blk_device.region.block_size.to_i >= IDEAL_SECTOR_SIZE
      end
    end
  end
end
