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

module Agama
  module Storage
    module ISCSI
      module Configs
        # iSCSI target config.
        class Target
          # Target IP address.
          #
          # @return [String, nil]
          attr_accessor :address

          # Target port.
          #
          # @return [Integer, nl]
          attr_accessor :port

          # Target name.
          #
          # @return [String, nil]
          attr_accessor :name

          # Target interface.
          #
          # @return [String, nil]
          attr_accessor :interface

          # Startup mode.
          #
          # @return [String, nil]
          attr_accessor :startup

          # Username for authentication by target.
          #
          # @return [String, nil]
          attr_accessor :username

          # Password for authentication by target
          #
          # @return [String, nil]
          attr_accessor :password

          # Username for authentication by initiator.
          #
          # @return [String, nil]
          attr_accessor :initiator_username

          # Password for authentication by initiator.
          #
          # @return [String, nil]
          attr_accessor :initiator_password
        end
      end
    end
  end
end
