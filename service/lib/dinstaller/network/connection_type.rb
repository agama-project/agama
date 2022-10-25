# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
  module Network
    # Connection type
    #
    # The values are kind of coupled to NetworkManager. We can change them
    # as soon as we support another backend.
    class ConnectionType
      # @return [String] Type ID
      attr_reader :id

      # @return [String] Type name
      attr_reader :name

      class << self
        # Returns all the known IDs
        #
        # @return [ConnectionType]
        def all
          [ETHERNET, WIRELESS]
        end

        # Returns the known IDs
        #
        # @param id [String] State ID
        # @return [ConnectionState,nil]
        def by_id(id)
          all.find { |s| s.id == id }
        end
      end

      # @param id [String] Type ID
      # @param name [String] Type name
      def initialize(id, name)
        @id = id
        @name = name
      end

      # Determines whether two types are the same
      #
      # @param [ConnectionState]
      # @return [Boolean]
      def ==(other)
        @id == other.id
      end

      ETHERNET = new("802-3-ethernet", "Ethernet")
      WIRELESS = new("802-11-wireless", "Wireless")
    end
  end
end
