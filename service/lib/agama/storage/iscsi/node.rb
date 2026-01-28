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

require "yast2/equatable"

module Agama
  module Storage
    module ISCSI
      # Class to represent an Open-iscsi node
      #
      # Bear in mind Open-iscsi does not use the term node as defined by the iSCSI RFC, where a node
      # is a single iSCSI initiator or target. Open-iscsi uses the term node to refer to a portal on
      # a target
      class Node
        include Yast2::Equatable

        # Target IP address
        #
        # @return [String]
        attr_accessor :address

        # Target port
        #
        # @return [Integer]
        attr_accessor :port

        # Target name
        #
        # @return [String]
        attr_accessor :target

        # Target interface
        #
        # @return [String]
        attr_accessor :interface

        # Whether the node was initiated by iBFT
        #
        # @return [Boolean]
        attr_accessor :ibft

        # Whether the node is connected (there is a session)
        #
        # @return [Boolean]
        attr_accessor :connected

        # Startup status
        #
        # @return [String]
        attr_accessor :startup

        # Whether the node is locked (cannot be deactivated)
        #
        # @return [Boolean]
        attr_accessor :locked

        eql_attr :address, :port, :target, :interface, :ibft, :connected, :startup, :locked

        def locked?
          !!locked
        end

        def ibft?
          !!ibft
        end

        def connected?
          !!connected
        end

        def portal
          "#{address}:#{port}"
        end

        def portal=(value)
          address, port = value.split(":")

          @address = address
          @port = port.to_i
        end
      end
    end
  end
end
