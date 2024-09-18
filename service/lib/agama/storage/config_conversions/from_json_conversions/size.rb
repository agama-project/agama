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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/configs/size"
require "y2storage/disk_size"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Size conversion from JSON hash according to schema.
        class Size < Base
          # @param size_json [Hash]
          def initialize(size_json)
            super()
            @size_json = size_json
          end

          # @see Base#convert
          #
          # @param default [Configs::Size, nil]
          # @return [Configs::Size]
          def convert(default = nil)
            super(default || Configs::Size.new)
          end

        private

          # @return [Hash]
          attr_reader :size_json

          # @see Base#conversions
          #
          # @param _default [Configs::Size]
          # @return [Hash]
          def conversions(_default)
            {
              default: false,
              min:     convert_size(:min),
              max:     convert_size(:max) || Y2Storage::DiskSize.unlimited
            }
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_size(field)
            value = case size_json
            when Hash
              size_json[field]
            when Array
              field == :max ? size_json[1] : size_json[0]
            else
              size_json
            end

            return unless value

            begin
              # This parses without legacy_units, ie. "1 GiB" != "1 GB"
              Y2Storage::DiskSize.new(value)
            rescue TypeError
              # JSON schema validations should prevent this from happening
            end
          end
        end
      end
    end
  end
end
