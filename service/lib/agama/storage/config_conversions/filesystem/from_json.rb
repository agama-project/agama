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

require "agama/storage/configs/btrfs"
require "agama/storage/configs/filesystem"
require "y2storage/filesystems/type"

module Agama
  module Storage
    module ConfigConversions
      module Filesystem
        # Filesystem conversion from JSON hash according to schema.
        class FromJSON
          # @param filesystem_json [Hash, String]
          def initialize(filesystem_json)
            @filesystem_json = filesystem_json
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param default [Configs::Filesystem, nil]
          # @return [Configs::Filesystem]
          def convert(default = nil)
            default_config = default.dup || Configs::Filesystem.new

            default_config.tap do |config|
              btrfs = convert_btrfs(config.btrfs)

              config.type = convert_type
              config.btrfs = btrfs if btrfs
            end
          end

        private

          # @return [Hash]
          attr_reader :filesystem_json

          # @return [Y2Storage::Filesystems::Type]
          def convert_type
            value = filesystem_json.is_a?(String) ? filesystem_json : "btrfs"
            Y2Storage::Filesystems::Type.find(value.to_sym)
          end

          # @param default [Configs::Btrfs]
          # @return [Configs::Btrfs, nil]
          def convert_btrfs(default = nil)
            return nil if filesystem_json.is_a?(String)

            btrfs_json = filesystem_json[:btrfs]
            default_config = default.dup || Configs::Btrfs.new

            default_config.tap do |config|
              snapshots = btrfs_json[:snapshots]

              config.snapshots = snapshots if snapshots
            end
          end
        end
      end
    end
  end
end
