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

require "agama/storage/configs/size"
require "y2storage/disk_size"

module Agama
  module Storage
    module ConfigConversions
      module Size
        # Size conversion from JSON hash according to schema.
        class FromJSON
          # @param size_json [Hash]
          def initialize(size_json)
            @size_json = size_json
          end

          # @todo Add support for auto.
          # @todo For now only {min: number, max: number} schema is supported. Add support for a
          #   direct value (e.g., 1024, "2 GiB"), and array format ([min, max]).
          #
          # Performs the conversion from Hash according to the JSON schema.
          #
          # @return [Configs::Size]
          def convert
            Configs::Size.new.tap do |config|
              config.min = convert_min
              config.max = convert_max || Y2Storage::DiskSize.unlimited
            end
          end

        private

          # @return [Hash]
          attr_reader :size_json

          # @return [Y2Storage::DiskSize]
          def convert_min
            Y2Storage::DiskSize.new(size_json[:min])
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_max
            value = size_json[:max]
            return unless value

            Y2Storage::DiskSize.new(value)
          end
        end
      end
    end
  end
end
