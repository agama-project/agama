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

require "agama/storage/config_conversions/from_json_conversions/filesystem_type"
require "agama/storage/configs/filesystem"
require "y2storage/filesystems/mount_by_type"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Filesystem conversion from JSON hash according to schema.
        class Filesystem
          # @param filesystem_json [Hash]
          def initialize(filesystem_json)
            @filesystem_json = filesystem_json
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @param default [Configs::Filesystem, nil]
          # @return [Configs::Filesystem]
          def convert(default = nil)
            default_config = default.dup || Configs::Filesystem.new

            values = {
              reuse:         filesystem_json[:reuseIfPossible],
              label:         filesystem_json[:label],
              path:          filesystem_json[:path],
              mount_options: filesystem_json[:mountOptions],
              mkfs_options:  filesystem_json[:mkfsOptions],
              mount_by:      convert_mount_by,
              type:          convert_type(default_config.type)
            }

            default_config.tap do |config|
              values.each do |property, value|
                config.public_send("#{property}=", value) unless value.nil?
              end
            end
          end

        private

          # @return [Hash]
          attr_reader :filesystem_json

          # @return [Y2Storage::Filesystems::MountByType, nil]
          def convert_mount_by
            value = filesystem_json[:mountBy]
            return unless value

            Y2Storage::Filesystems::MountByType.find(value.to_sym)
          end

          # @param default [Configs::FilesystemType, nil]
          # @return [Configs::FilesystemType, nil]
          def convert_type(default = nil)
            filesystem_type_json = filesystem_json[:type]
            return unless filesystem_type_json

            FromJSONConversions::FilesystemType.new(filesystem_type_json).convert(default)
          end
        end
      end
    end
  end
end
