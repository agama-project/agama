# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "y2storage"

module Agama
  module Storage
    # Class representing a bootloader.
    class Bootloader
      # @return [Y2Storage::BootloaderType] Type of the bootloader
      attr_reader :type

      # @param type [Y2Storage::BootloaderType] Type of the bootloader.
      # @param tpm [Boolean] Whether TPM is available for the bootloader.
      def initialize(type, tpm: false)
        @type = type
        @tpm = tpm
      end

      # Whether the bootloader is able to manage a password for encryption authentication.
      #
      # @return [Boolean]
      def password_encryption_auth?
        true
      end

      # Whether the bootloader is able to use TPM for encryption authentication.
      #
      # @return [Boolean]
      def tpm_encryption_auth?
        @tpm
      end
    end
  end
end
