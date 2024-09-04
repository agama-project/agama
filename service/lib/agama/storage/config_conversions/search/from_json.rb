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

module Agama
  module Storage
    module ConfigConversions
      module Search
        # Search conversion from JSON hash according to schema.
        class FromJSON
          # @param search_json [Hash, String]
          def initialize(search_json)
            @search_json = search_json
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param default [Configs::Search, nil]
          # @return [Configs::Search]
          def convert(default = nil)
            default_config = default.dup || Configs::Search.new

            default_config.tap do |config|
              name = convert_name
              not_found = convert_not_found

              config.name = name if name
              config.if_not_found = not_found if not_found
            end
          end

        private

          # @return [Hash, String]
          attr_reader :search_json

          # @return [String, nil]
          def convert_name
            return search_json if search_json.is_a?(String)

            search_json.dig(:condition, :name)
          end

          # @return [Symbol, nil]
          def convert_not_found
            return if search_json.is_a?(String)

            value = search_json[:ifNotFound]
            return unless value

            value.to_sym
          end
        end
      end
    end
  end
end
