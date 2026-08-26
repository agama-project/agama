# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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
        # Mixin for search conversion.
        #
        # Classes including this mixin must define the search converter to use (e.g.,
        # {FromJSONConversions::DriveSearch}), see {#search_converter_class}.
        module WithSearch
          # @return [Configs::Search, nil]
          def convert_search
            search_json = config_json[:search]
            return unless search_json

            search_converter_class.new(search_json).convert
          end

          # Converter for the search of the device, according to its JSON schema.
          #
          # @return [Class]
          def search_converter_class
            raise "Undefined search converter"
          end
        end
      end
    end
  end
end
