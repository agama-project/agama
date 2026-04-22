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

module Agama
  module Storage
    module Bootloaders
      # Base class for the bootloaders.
      class Base
        # Whether the bootloader is able to manage a password for encryption authentication.
        #
        # @note This method is expected to be redefined by derived classes.
        #
        # @return [Boolean]
        def password_encryption_auth?
          false
        end

        # Whether the bootloader is able to use TPM for encryption authentication.
        #
        # @note This method is expected to be redefined by derived classes.
        #
        # @return [Boolean]
        def tpm_encryption_auth?
          false
        end
      end
    end
  end
end
