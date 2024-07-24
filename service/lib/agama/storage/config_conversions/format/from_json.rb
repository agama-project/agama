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

require "agama/storage/configs/format"
require "y2storage/filesystems/type"

module Agama
  module Storage
    module ConfigConversions
      module Format
        # Format conversion from JSON hash according to schema.
        class FromJSON
          # @param format_json [Hash]
          # @param default [Configs::Format, nil]
          def initialize(format_json, default: nil)
            @format_json = format_json
            @default_config = default || Configs::Format.new
          end

          # @todo Add support for Btrfs options (snapshots, subvols).
          #
          # Performs the conversion from Hash according to the JSON schema.
          #
          # @return [Configs::Format]
          def convert
            default_config.dup.tap do |config|
              config.filesystem = convert_filesystem
              config.label = format_json[:label]
              config.mkfs_options = format_json[:mkfsOptions] || []
            end
          end

        private

          # @return [Hash]
          attr_reader :format_json

          # @return [Configs::Format]
          attr_reader :default_config

          def convert_filesystem
            Y2Storage::Filesystems::Type.find(format_json[:filesystem].to_sym)
          end
        end
      end
    end
  end
end
