# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

require "agama/storage/config_conversions/to_json_conversions/search"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Mixin for delete conversion to JSON.
        #
        # The class is also expected to include WithSearch and WithSize.
        module WithDelete
          # @return [Hash, nil]
          def convert_delete
            return unless convert_delete?

            config.delete? ? convert_mandatory_delete : convert_optional_delete
          end

          def convert_delete?
            config.delete? || config.delete_if_needed?
          end

          # @return [Hash]
          def convert_mandatory_delete
            {
              search: convert_search,
              delete: true
            }
          end

          # @return [Hash]
          def convert_optional_delete
            {
              search:         convert_search,
              size:           convert_size,
              deleteIfNeeded: true
            }
          end
        end
      end
    end
  end
end
