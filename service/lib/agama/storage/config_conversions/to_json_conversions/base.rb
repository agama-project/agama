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
      module ToJSONConversions
        # Base class for conversions to JSON hash according to schema.
        class Base
          # Performs the conversion to Hash according to the JSON schema.
          #
          # @return [Hash, nil]
          def convert
            config_json = {}

            conversions.each do |property, value|
              next if value.nil?

              config_json[property] = value
            end

            config_json.empty? ? nil : config_json
          end

        private

          # @return [Object] See {#initialize}.
          attr_reader :config

          # Values to generate the JSON.
          #
          # @return [Hash] e.g., { name: "/dev/vda" }.
          def conversions
            {}
          end
        end
      end
    end
  end
end
