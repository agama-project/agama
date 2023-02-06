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

module DInstaller
  module Storage
    module Iscsi
      # Class to represent an Open-iscsi node
      #
      # Bear in mind Open-iscsi does not use the term node as defined by the iSCSI RFC, where a node
      # is a single iSCSI initiator or target. Open-iscsi uses the term node to refer to a portal on
      # a target
      class Node
        attr_reader :portal_address
        attr_reader :portal_port
        attr_reader :target_name
        attr_reader :interface
        attr_reader :connected
        attr_reader :startup

        # Class methods
        class << self
          def new_from_yast_session(yast_session)
            session = new
            session.initialize_from_yast_session(yast_session)
            session
          end

          def new_from_yast_discovered(yast_target)
            target = new
            target.initialize_from_yast_discovered(yast_target)
            target
          end
        end

        def initialize_from_yast(yast_target)
          self.portal = yast_target[0]
          @target_name = yast_target[1]
          @interface = yast_target[2] || "default"
        end

        def initialize_from_yast_session(yast_session)
          initialize_from_yast(yast_session)
          @connected = true

          Yast::IscsiClientLib.currentRecord = to_yast
          # FIXME: the calculation of both @startup and @ibft imply executing getCurrentNodeValues
          # (ie. calling iscsiadm)
          @startup = Yast::IscsiClientLib.getStartupStatus
          # FIXME: should this be moved to initialize_from_yast?
          @ibft = Yast::IscsiClientLib.iBFT?(Yast::IscsiClientLib.getCurrentNodeValues)
        end

        def initialize_from_yast_discovered(yast_target)
          initialize_from_yast(yast_target)
          @connected = false
        end

        def to_yast
          [portal, target_name, interface]
        end

        def portal
          "#{portal_address}:#{portal_port}"
        end

        def ibft?
          !!@ibft
        end

      private

        def portal=(string)
          @portal_address, @portal_port = string.split(":")
        end
      end
    end
  end
end
