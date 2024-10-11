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
require "agama/storage/config_conversions/from_json_conversions/filesystem_type"
require "agama/storage/configs/filesystem"
require "y2storage/filesystems/mount_by_type"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Filesystem conversion from JSON hash according to schema.
        class Filesystem < Base
          # @see Base#convert
          # @return [Configs::Filesystem]
          def convert
            super(Configs::Filesystem.new)
          end

        private

          alias_method :filesystem_json, :config_json

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              reuse:         filesystem_json[:reuseIfPossible],
              label:         filesystem_json[:label],
              path:          filesystem_json[:path],
              mount_options: filesystem_json[:mountOptions],
              mkfs_options:  filesystem_json[:mkfsOptions],
              mount_by:      convert_mount_by,
              type:          convert_type
            }
          end

          # @return [Y2Storage::Filesystems::MountByType, nil]
          def convert_mount_by
            value = filesystem_json[:mountBy]
            return unless value

            Y2Storage::Filesystems::MountByType.find(value.to_sym)
          end

          # @return [Configs::FilesystemType, nil]
          def convert_type
            filesystem_type_json = filesystem_json[:type]
            return unless filesystem_type_json

            FromJSONConversions::FilesystemType.new(filesystem_type_json).convert
          end
        end
      end
    end
  end
end
