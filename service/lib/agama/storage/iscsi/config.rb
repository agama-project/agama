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
      # iSCSI config.
      class Config
        # Initiator name.
        #
        # @return [String, nil]
        attr_accessor :initiator

        # List of targets.
        #
        # @return [Array<Configs::Target>, nil] If nil, then targets are not configured.
        attr_accessor :targets

        # All portals.
        #
        # @return [Array<String>]
        def portals
          return [] unless targets

          targets.map(&:portal).uniq
        end

        # All interfaces from a portal.
        #
        # @param portal [String]
        # @return [Array<String>]
        def interfaces(portal)
          targets
            .select { |t| t.portal?(portal) }
            .map(&:interface)
            .compact
            .uniq
        end
      end
    end
  end
end
