# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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

require "agama/storage/config_conversions/to_model_conversions/base"
require "agama/storage/config_conversions/to_model_conversions/with_filesystem"
require "agama/storage/config_conversions/to_model_conversions/with_resize"
require "agama/storage/config_conversions/to_model_conversions/with_size"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # LVM logical volume conversion to model according to the JSON schema.
        class LogicalVolume < Base
          include WithFilesystem
          include WithResize
          include WithSize

          # @param config [Configs::LogicalVolume]
          # @param volumes [VolumeTemplatesBuilder]
          def initialize(config, volumes)
            super()
            @config = config
            @volumes = volumes
          end

        private

          # @return [VolumeTemplatesBuilder]
          attr_reader :volumes

          # @see Base#conversions
          def conversions
            {
              name:           config.device_name,
              lvName:         config.name,
              mountPath:      config.filesystem&.path,
              filesystem:     convert_filesystem,
              stripes:        config.stripes,
              stripeSize:     config.stripe_size&.to_i,
              size:           convert_size,
              delete:         config.delete?,
              deleteIfNeeded: config.delete_if_needed?,
              resize:         convert_resize,
              resizeIfNeeded: convert_resize_if_needed
            }
          end
        end
      end
    end
  end
end
