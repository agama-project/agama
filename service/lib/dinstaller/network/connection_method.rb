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
    class ConnectionMethod
      # @return [String] Method ID (e.g., "auto")
      attr_reader :id
      # @return [String] Method label (e.g., "Automatic")
      attr_reader :name

      class << self
        # Returns all the known IDs
        #
        # @return [ConnectionState]
        def all
          [AUTO, MANUAL]
        end

        # Returns the known IDs
        #
        # @param id [String] Method ID
        # @return [ConnectionMethod,nil]
        def by_id(id)
          all.find { |s| s.id == id }
        end
      end

      # @param id [String] Method ID
      # @param name [String] Method label
      def initialize(id, name)
        @id = id
        @name = name
      end

      # Determines whether two methods are the same
      #
      # @param [ConnectionState] Method to compare with
      # @return [Boolean]
      def ==(other)
        id == other.id
      end

      AUTO = new("auto", "Automatic")
      MANUAL = new("manual", "Manual")
    end
  end
end
