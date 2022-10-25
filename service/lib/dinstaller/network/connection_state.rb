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
    # Connection states
    #
    # The values are kind of coupled to NetworkManager. We can change them
    # as soon as we support another backend.
    class ConnectionState
      # @return [Integer] State ID (e.g., 1)
      attr_reader :id
      # @return [String] State label (e.g., "Activating")
      attr_reader :name

      class << self
        # Returns all the known IDs
        #
        # @return [ConnectionState]
        def all
          [UNKNOWN, ACTIVATING, ACTIVATED, DEACTIVATING, DEACTIVATED]
        end

        # Returns the known IDs
        #
        # @param id [Integer] State ID
        # @return [ConnectionState,nil]
        def by_id(id)
          all.find { |s| s.id == id }
        end
      end

      # @param id [Integer] State ID
      # @param name [String] State label
      def initialize(id, name)
        @id = id
        @name = name
      end

      # Determines whether two states are the same
      #
      # @param [ConnectionState] State to compare with
      # @return [Boolean]
      def ==(other)
        id == other.id
      end

      UNKNOWN = new(0, "Unknown")
      ACTIVATING = new(1, "Activating")
      ACTIVATED = new(2, "Activated")
      DEACTIVATING = new(3, "Deactivating")
      DEACTIVATED = new(4, "Deactivated")
    end
  end
end
