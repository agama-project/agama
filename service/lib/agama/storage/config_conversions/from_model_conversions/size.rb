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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/configs/size"
require "y2storage/disk_size"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Size conversion from model according to the JSON schema.
        class Size < Base
        private

          alias_method :size_model, :model_json

          # @see Base
          # @return [Configs::Size]
          def default_config
            Configs::Size.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              default: size_model[:default],
              min:     convert_min_size,
              max:     convert_max_size
            }
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_min_size
            value = size_model[:min]
            return unless value

            disk_size(value)
          end

          # @return [Y2Storage::DiskSize]
          def convert_max_size
            value = size_model[:max]
            return Y2Storage::DiskSize.unlimited unless value

            disk_size(value)
          end

          # @param value [Integer]
          # @return [Y2Storage::DiskSize]
          def disk_size(value)
            Y2Storage::DiskSize.new(value)
          end
        end
      end
    end
  end
end
