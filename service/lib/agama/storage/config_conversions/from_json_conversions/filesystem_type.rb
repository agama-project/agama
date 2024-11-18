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
          # @see Base#convert
          # @return [Configs::FilesystemType]
          def convert
            super(Configs::FilesystemType.new)
          end

        private

          alias_method :filesystem_type_json, :config_json

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              default: false,
              fs_type: convert_type,
              btrfs:   convert_btrfs
            }
          end

          # @return [Y2Storage::Filesystems::Type, nil]
          def convert_type
            value = filesystem_type_json.is_a?(String) ? filesystem_type_json : "btrfs"
            Y2Storage::Filesystems::Type.find(value.to_sym)
          end

          # @return [Configs::Btrfs, nil]
          def convert_btrfs
            return if filesystem_type_json.is_a?(String)

            btrfs_json = filesystem_type_json[:btrfs]
            return unless btrfs_json

            FromJSONConversions::Btrfs.new(btrfs_json).convert
          end
        end
      end
    end
  end
end
