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

module Agama
  module Storage
    module Fcoe
      # Blah
      class FcoeVlan
        # Device name of the VLAN interface (eg. "eth1.500-fcoe")
        #
        # @return [String] empty string if there is no network interface for the VLAN
        attr_accessor :device

        # Whether FCoE service is enabled at the ethernet port
        #
        # This corresponds to the setting FCOE_ENABLE at /etc/fcoe/cfg-xxx
        #
        # @return [Boolean]
        attr_accessor :fcoe_service
        alias_method :fcoe_service?, :fcoe_service

        # Whether DCB service is required at the ethernet port
        #
        # This corresponds to the setting DCB_REQUIRED at /etc/fcoe/cfg-xxx
        #
        # @return [Boolean]
        attr_accessor :dcb_service
        alias_method :dcb_service?, :dcb_service

        # Whether VLAN discovery should be handled by fcoemon
        #
        # This corresponds to the setting AUTO_VLAN at /etc/fcoe/cfg-xxx
        #
        # @return [Boolean]
        attr_accessor :auto_vlan
        alias_method :auto_vlan?, :auto_vlan

        # Whether there is an active network interface for the FCoE VLAN
        #
        # @return [Boolean]
        def up?
          device != ""
        end
      end
    end
  end
end
