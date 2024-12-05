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
require "agama/storage/config_conversions/from_model_conversions/drive"
require "agama/storage/config"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Config conversion from model according to the JSON schema.
        class Config < Base
        private

          # @see Base
          # @return [Storage::Config]
          def default_config
            Storage::Config.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              drives: convert_drives
            }
          end

          # @return [Array<Configs::Drive>, nil]
          def convert_drives
            drive_models = model_json[:drives]
            return unless drive_models

            drive_models.map { |d| convert_drive(d) }
          end

          # @param drive_model [Hash]
          # @return [Configs::Drive]
          def convert_drive(drive_model)
            FromModelConversions::Drive.new(drive_model).convert
          end
        end
      end
    end
  end
end
