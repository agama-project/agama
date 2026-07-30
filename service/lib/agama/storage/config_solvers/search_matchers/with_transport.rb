# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "agama/storage/configs/search_conditions"

module Agama
  module Storage
    module ConfigSolvers
      module SearchMatchers
        # Mixin for matchers supporting the transport condition.
        #
        # Only for matchers whose subject is a device with transport (that is, a drive).
        module WithTransport
        private

          # @see Base#match_leaf?
          def match_leaf?(node, device)
            if node.is_a?(Configs::SearchConditions::Transport)
              return match_transport?(node, device)
            end

            super
          end

          # Whether the data transport of the given device matches the condition node.
          #
          # Note not every kind of drive has a transport (e.g., a DASD has none). A device with an
          # undetermined transport never matches, see {Configs::SearchConditions::Transport}.
          #
          # @param node [Configs::SearchConditions::Transport]
          # @param device [Y2Storage::BlkDevice]
          #
          # @return [Boolean]
          def match_transport?(node, device)
            return true unless node.transport
            return false unless device.respond_to?(:transport)

            transport = device.transport
            return false if transport.nil? || transport.is?(:unknown)

            transport == node.transport
          end
        end
      end
    end
  end
end
