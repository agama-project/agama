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

require "yast"
require "y2fcoe_client/inst_client"
require "y2fcoe_client/actions"

Yast.import "FcoeClient"

module Agama
  module Storage
    module Fcoe
      # Manager for FCoE
      class Manager
        # Constructor
        #
        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @inst_client = Y2FcoeClient::InstClient.new
          @interfaces = []

          @on_probe_callbacks = []
          @on_interfaces_change_callbacks = []
        end

        # Probes FCoE
        #
        # Callbacks are called at the end, see {#on_probe}.
        def probe
          logger.info "Probing FCoE"
          inst_client.read(silent: true)

          @interfaces = Yast::FcoeClient.GetNetworkCards.map.with_index do |card, idx|
            iface_from(card, idx)
          end
          @on_probe_callbacks.each(&:call)
        end

        def create_fcoe_vlan(iface)
          return 1 unless iface.fcoe_vlan_possible?

          action = Y2FcoeClient::Actions::Create.new(iface.yast_index)
          issues = action.validate
          return 2 if issues.error?

          issues = action.execute
          return 3 if issues.any?

          iface.fcoe_vlan = fcoe_vlan_from(Yast::FcoeClient.GetNetworkCards[iface.yast_index])
          write
          0
        end

        def remove_fcoe_vlan(iface)
          return 1 unless iface.fcoe_vlan&.up?

          action = Y2FcoeClient::Actions::Remove.new(iface.yast_index)
          issues = action.execute
          return 2 if issues.any?

          iface.fcoe_vlan = fcoe_vlan_from(Yast::FcoeClient.GetNetworkCards[iface.yast_index])
          write
          0
        end

        def update_fcoe_vlan(iface, attr, value)
          iface.fcoe_vlan.public_send(":#{attr}=", value)

          values = Yast::FcoeClient.GetNetworkCards[iface.yast_index]
          key = FCOE_VLAN_CONFIG_MAPPING[attr].to_s
          values[key] = value ? "yes" : "no"
          Yast::FcoeClient.SetNetworkCardsValue(iface.yast_index, values)
          Yast::FcoeClient.SetModified(true)
          write
        end

        private

        def write
          # FIXME: this always adds fcoe-utils and yast2-fcoe-client to the resolvables
          inst_client.write
          @on_interfaces_change_callbacks.each(&:call)
        end

        # Attributes used to configure the FCoE VLAN
        FCOE_VLAN_CONFIG_MAPPING = {
          fcoe_service: :fcoe_enable,
          dcb_service:  :dcb_required,
          auto_vlan:    :auto_vlan
        }

        def iface_from(card, index)
          Interface.new.tap do |iface|
            # Needed for mapping with Yast::FcoeClient
            iface.yast_index    = index

            # General information of the interface
            iface.parent_device = str_value(card,  :dev_name)
            iface.vlan_id       = str_value(card,  :vlan_interface)
            iface.fcf_mac       = str_value(card,  :mac_addr)
            iface.model         = str_value(card,  :device)
            iface.driver        = str_value(card,  :driver)
            iface.dcb_capable   = bool_value(card, :dcb_capable)

            if card["fcoe_vlan"] == Yast::FcoeClient.NOT_AVAILABLE
              iface.fcoe_vlan_supported = false
            else
              iface.fcoe_vlan_supported = true
              iface.fcoe_vlan = fcoe_vlan_from(card)
            end
          end
        end

        def fcoe_vlan_from(card)
          FcoeVlan.new.tap do |vlan|
            vlan.device =
              if card["fcoe_vlan"] == Yast::FcoeClient.NOT_CONFIGURED
                ""
              else
                card["fcoe_vlan"]
              end

            FCOE_VLAN_CONFIG_MAPPING.each_pair do |attr, field|
              iface.public_send(":#{attr}=", bool_value(card, field))
            end
          end
        end

        def str_value(card, field)
          card[field.to_s] || ""
        end

        def bool_value(card, field)
          card[field.to_s] == "yes"
        end
      end
    end
  end
end
