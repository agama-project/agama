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

require "agama/storage/config_conversions/filesystem_type/from_json"
require "agama/storage/configs/filesystem"

module Agama
  module Storage
    module ConfigConversions
      module Filesystem
        # Filesystem conversion from JSON hash according to schema.
        class FromJSON
          # @param filesystem_json [Hash]
          def initialize(filesystem_json)
            @filesystem_json = filesystem_json
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param default [Configs::Filesystem, nil]
          # @return [Configs::Format]
          def convert(default = nil)
            default_config = default.dup || Configs::Filesystem.new

            default_config.tap do |config|
              label = filesystem_json[:label]
              mkfs_options = filesystem_json[:mkfsOptions]

              config.path = filesystem_json[:path]
              config.mount_options = filesystem_json[:mountOptions] || []
              config.type = convert_type(config.type)
              config.label = label if label
              config.mkfs_options = mkfs_options if mkfs_options
            end
          end

        private

          # @return [Hash]
          attr_reader :filesystem_json

          # @param default [Configs::Filesystem, nil]
          # @return [Configs::FilesystemType]
          def convert_type(default = nil)
            FilesystemType::FromJSON.new(format_json[:type]).convert(default)
          end
        end
      end
    end
  end
end
