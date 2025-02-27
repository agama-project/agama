# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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
require "agama/storage/config_conversions/from_model_conversions/filesystem_type"
require "agama/storage/configs/filesystem"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Filesystem conversion from model according to the JSON schema.
        class Filesystem < Base
        private

          # @see Base
          # @return [Configs::Filesystem]
          def default_config
            Configs::Filesystem.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              reuse: model_json.dig(:filesystem, :reuse),
              path:  model_json[:mountPath],
              type:  convert_type,
              label: model_json.dig(:filesystem, :label)
            }
          end

          # @return [Configs::FilesystemType, nil]
          def convert_type
            filesystem_model = model_json[:filesystem]
            return if filesystem_model.nil?

            FromModelConversions::FilesystemType.new(filesystem_model).convert
          end
        end
      end
    end
  end
end
