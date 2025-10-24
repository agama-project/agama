# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

module Agama
  module Storage
    # Temporary mixin to prevent encrypting partitions that would become useless if encrypted.
    #
    # This module will be needed as long as the user UI does not provide a way to fine-tune
    # encryption per partition.
    module ModelRefuseEncryption
      # Filesystems created on these paths should never be encrypted.
      #
      # The case of /boot/efi and /boot/zipl are clear, encrypting those partitions means
      # the firmware cannot read the content.
      #
      # The case of /boot is more debatable, but users specifying a separate /boot very likely
      # want that filesystem to be as "plain" as possible (no encryption, no LVM, etc.). That's,
      # after all, the main reason to separate /boot.
      PATHS = ["/boot/efi", "/boot/zipl", "/boot"].freeze
      private_constant :PATHS

      # Whether the model should prevent encryption for the given mount path
      #
      # @param path [String, Pathname]
      # @return [Boolean]
      def refuse_encryption_path?(path)
        PATHS.include?(Pathname.new(path).cleanpath.to_s)
      end
    end
  end
end
