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

require "y2storage/encryption_method/swap"

module Y2Storage
  module EncryptionMethod
    # Encryption swap method (see {Swap}) to encrypt a device by using a random password
    class RandomSwap < Swap
      KEY_FILE = "/dev/urandom".freeze
      private_constant :KEY_FILE

      def initialize
        textdomain "storage"
        super(:random_swap, _("Encryption with Volatile Random Key"))
      end
    end
  end
end
