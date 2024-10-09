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
      module FromJSONConversions
        # Base class for conversions from JSON hash according to schema.
        class Base
          def initialize(config_json)
            @config_json = config_json
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param config [Object] A {Config} or any of its configs from {Storage::Configs}.
          # @return [Object] A {Config} or any its configs from {Storage::Configs}.
          def convert(config)
            conversions.each do |property, value|
              next if value.nil?

              config.public_send("#{property}=", value)
            end

            config
          end

        private

          attr_reader :config_json

          # Values to apply to the config.
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
