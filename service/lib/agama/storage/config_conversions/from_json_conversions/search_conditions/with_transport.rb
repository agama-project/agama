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
require "y2storage/data_transport"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        module SearchConditions
          # Mixin for converters supporting the transport condition.
          #
          # Only for converters of a search of devices with transport (that is, drives).
          module WithTransport
          private

            # @see Base#convert_leaf
            def convert_leaf(json)
              return transport_condition(json[:transport]) if json.key?(:transport)

              super
            end

            # @param value [String]
            # @return [Configs::SearchConditions::Transport]
            def transport_condition(value)
              transport = Y2Storage::DataTransport.find(value.to_sym)
              Configs::SearchConditions::Transport.new(transport)
            end
          end
        end
      end
    end
  end
end
