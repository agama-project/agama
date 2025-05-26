# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/storage/config_conversions/to_model_conversions/with_size"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # LVM logical volume conversion to model according to the JSON schema.
        class LogicalVolume < Base
          include WithFilesystem
          include WithSize

          # @param config [Configs::LogicalVolume]
          def initialize(config)
            super()
            @config = config
          end

        private

          # @see Base#conversions
          def conversions
            {
              lvName:     config.name,
              mountPath:  config.filesystem&.path,
              filesystem: convert_filesystem,
              size:       convert_size,
              stripes:    config.stripes,
              stripeSize: config.stripe_size&.to_i
            }
          end
        end
      end
    end
  end
end
