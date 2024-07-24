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

require "agama/storage/config_conversions/filesystem/from_json"
require "agama/storage/configs/format"

module Agama
  module Storage
    module ConfigConversions
      module Format
        # Format conversion from JSON hash according to schema.
        class FromJSON
          # @param format_json [Hash]
          def initialize(format_json)
            @format_json = format_json
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param default [Configs::Format, nil]
          # @return [Configs::Format]
          def convert(default = nil)
            default_config = default.dup || Configs::Format.new

            default_config.tap do |config|
              label = format_json[:label]
              mkfs_options = format_json[:mkfsOptions]

              config.filesystem = convert_filesystem(config.filesystem)
              config.label = label if label
              config.mkfs_options = mkfs_options if mkfs_options
            end
          end

        private

          # @return [Hash]
          attr_reader :format_json

          # @param default [Configs::Filesystem, nil]
          # @return [Configs::Filesystem]
          def convert_filesystem(default = nil)
            Filesystem::FromJSON.new(format_json[:filesystem]).convert(default)
          end
        end
      end
    end
  end
end
