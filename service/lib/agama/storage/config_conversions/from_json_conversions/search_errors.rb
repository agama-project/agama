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

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Error raised when a search condition is not supported by the kind of device that is
        # being converted (e.g., a partition id condition at a drive search).
        #
        # The JSON schema already rejects those documents, so this error only happens if the JSON
        # was not validated.
        class UnsupportedSearchCondition < StandardError
          # @param json [Object] JSON of the unsupported condition.
          # @param converter_class [Class] Converter that does not support the condition.
          def initialize(json, converter_class)
            super("Unsupported search condition for #{converter_class}: #{json.inspect}")
          end
        end

        # Error raised when a sort criterion is not supported by the kind of device that is being
        # converted (e.g., sorting by partition number at a drive search).
        #
        # @see UnsupportedSearchCondition
        class UnsupportedSortCriterion < StandardError
          # @param name [Object] Name of the unsupported sort criterion.
          # @param converter_class [Class] Converter that does not support the criterion.
          def initialize(name, converter_class)
            super("Unsupported sort criterion for #{converter_class}: #{name.inspect}")
          end
        end
      end
    end
  end
end
