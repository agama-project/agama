# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "y2storage/secret_attributes"

module Agama
  module Storage
    # Settings regarding encryption for the Agama storage proposal
    class EncryptionSettings
      include Y2Storage::SecretAttributes

      # @!attribute encryption_password
      #   Password to use when creating new encryption devices
      #   @return [String, nil] nil if undetermined
      secret_attr :encryption_password

      # Whether the proposal must create encrypted devices
      #
      # @return [Boolean]
      def encrypt?
        !(encryption_password.nil? || encryption_password.empty?)
      end
    end
  end
end

