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

require "agama/storage/config_conversions/to_json_conversions/base"
require "agama/storage/config_conversions/to_json_conversions/luks1"
require "agama/storage/config_conversions/to_json_conversions/luks2"
require "agama/storage/config_conversions/to_json_conversions/pervasive_luks2"
require "agama/storage/configs/encryption"

module Agama
  module Storage
    module ConfigConversions
      module ToJSONConversions
        # Encryption conversion to JSON hash according to schema.
        class Encryption < Base
          # @see Base
          def self.config_type
            Configs::Encryption
          end

          # @see Base#convert
          # @return [Hash, String, nil]
          def convert
            return unless config.method

            super || convert_swap_encryption
          end

        private

          # @see Base#conversions
          def conversions
            method = config.method

            if method.is?(:luks1)
              convert_luks1
            elsif method.is?(:luks2)
              convert_luks2
            elsif method.is?(:pervasive_luks2)
              convert_pervasive_luks2
            else
              {}
            end
          end

          # @return [Hash]
          def convert_luks1
            { luks1: ToJSONConversions::Luks1.new(config).convert }
          end

          # @return [Hash]
          def convert_luks2
            { luks2: ToJSONConversions::Luks2.new(config).convert }
          end

          # @return [Hash]
          def convert_pervasive_luks2
            { pervasiveLuks2: ToJSONConversions::PervasiveLuks2.new(config).convert }
          end

          # @return [String]
          def convert_swap_encryption
            config.method.id.to_s
          end
        end
      end
    end
  end
end
