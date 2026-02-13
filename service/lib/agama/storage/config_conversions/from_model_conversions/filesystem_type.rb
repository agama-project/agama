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
require "agama/storage/configs/btrfs"
require "agama/storage/configs/filesystem_type"
require "y2storage/filesystems/type"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Filesystem type conversion from model according to the JSON schema.
        class FilesystemType < Base
        private

          alias_method :filesystem_model, :model_json

          # @see Base
          # @return [Configs::FilesystemType]
          def default_config
            Configs::FilesystemType.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              default: filesystem_model[:default],
              fs_type: convert_type,
              btrfs:   convert_btrfs
            }
          end

          # @return [Y2Storage::Filesystems::Type, nil]
          def convert_type
            value = filesystem_model[:type]
            return unless value

            value = "btrfs" if value.start_with?("btrfs")
            Y2Storage::Filesystems::Type.find(value.to_sym)
          end

          # @return [Configs::Btrfs, nil]
          def convert_btrfs
            type = filesystem_model[:type]
            return unless type&.start_with?("btrfs")

            Configs::Btrfs.new.tap { |c| c.snapshots = type != "btrfs" }
          end
        end
      end
    end
  end
end
