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
  module AutoYaST
    # Builds the Agama "iscsi" section from an AutoYaST profile.
    class IscsiReader
      # @param profile [ProfileHash] AutoYaST profile
      def initialize(profile)
        @profile = profile
      end

      # Returns a hash that corresponds to Agama "iscsi" section.
      #
      # @return [Hash]
      def read
        initiator = profile.fetch_as_hash("iscsi-client")["initiatorname"]
        targets = read_targets

        iscsi = {}
        iscsi["initiator"] = initiator if initiator
        iscsi["targets"] = targets if targets

        return {} if iscsi.empty?

        { "iscsi" => iscsi }
      end

    private

      attr_reader :profile

      # @return [Array<Hash>]
      def read_targets
        targets = profile.fetch_as_hash("iscsi-client")["targets"]
        return unless targets

        targets.map { |t| read_target(t) }
      end

      # @param profile_target [Hash]
      # @return [Hash]
      def read_target(profile_target)
        address, port = profile_target["portal"].split(":")
        name = profile_target["target"]
        startup = profile_target["startup"]
        interface = profile_target["iface"]

        target = {
          "address" => address,
          "port"    => port.to_i,
          "name"    => name
        }

        target["startup"] = startup if startup
        target["interface"] = interface if interface
        target
      end
    end
  end
end
