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

require "agama/storage/bootloaders/base"

module Agama
  module Storage
    module Bootloaders
      # Class representing systemd-boot bootloader.
      class SystemdBoot < Base
        # @param tpm [Boolean] Whether TPM is available for systemd-boot.
        def initialize(tpm: false)
          super()
          @tpm = tpm
        end

        # @see Base
        def password_encryption_auth?
          true
        end

        # @see Base
        def tpm_encryption_auth?
          @tpm
        end
      end
    end
  end
end
