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
require "agama/storage/config_conversions/from_json_conversions/btrfs"
require "agama/storage/configs/btrfs"
require "agama/storage/configs/filesystem_type"
require "y2storage/filesystems/type"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Filesystem type conversion from JSON hash according to schema.
        class FilesystemType < Base
          # @param filesystem_type_json [Hash, String]
          def initialize(filesystem_type_json)
            super()
            @filesystem_type_json = filesystem_type_json
          end

          # @see Base#convert
          #
          # @param default [Configs::FilesystemType, nil]
          # @return [Configs::FilesystemType]
          def convert(default = nil)
            super(default || Configs::FilesystemType.new)
          end

        private

          # @return [Hash, String]
          attr_reader :filesystem_type_json

          # @see Base#conversions
          #
          # @param default [Configs::FilesystemType]
          # @return [Hash]
          def conversions(default)
            {
              fs_type: convert_type,
              btrfs:   convert_btrfs(default.btrfs)
            }
          end

          # @return [Y2Storage::Filesystems::Type, nil]
          def convert_type
            value = filesystem_type_json.is_a?(String) ? filesystem_type_json : "btrfs"
            Y2Storage::Filesystems::Type.find(value.to_sym)
          end

          # @param default [Configs::Btrfs, nil]
          # @return [Configs::Btrfs, nil]
          def convert_btrfs(default = nil)
            return if filesystem_type_json.is_a?(String)

            btrfs_json = filesystem_type_json[:btrfs]
            return unless btrfs_json

            FromJSONConversions::Btrfs.new(btrfs_json).convert(default)
          end
        end
      end
    end
  end
end
