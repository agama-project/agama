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
      class Interface
        # @return [Integer]
        attr_accessor :yast_index

        # Device name of the network card (eg. "eth0")
        #
        # @return [String]
        attr_accessor :parent_device

        # VLAN identifier
        #
        # @return [String] "0" if the interface is not a VLAN
        attr_accessor :vlan_id

        # Model of the network card
        #
        # @return [String]
        attr_accessor :model

        # Driver used by the interface
        #
        # @return [String]
        attr_accessor :driver

        # Whether the interface has DCB (Data Center Bridging) capabilities
        #
        # @return [Boolean]
        attr_accessor :dcb_capable
        alias_method :dcb_capable?, :dcb_capable

        # Whether is possible to create an FCoE VLAN for the interface
        #
        # @return [Boolean]
        attr_accessor :fcoe_vlan_supported
        alias_method :fcoe_vlan_supported?, :fcoe_vlan_supported

        # Information about the possible FCoE VLAN for the interface
        #
        # @return [FcoeVlan, nil] nil if #fcoe_vlan_supported? is false
        attr_accessor :fcoe_vlan
      end
    end
  end
end
