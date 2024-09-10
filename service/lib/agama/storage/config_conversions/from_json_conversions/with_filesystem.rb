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

require "agama/storage/config_conversions/from_json_conversions/filesystem"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Mixin for filesystem conversion.
        module WithFilesystem
          # @param json [Hash]
          # @param default [Configs::Filesystem, nil]
          #
          # @return [Configs::Filesystem, nil]
          def convert_filesystem(json, default: nil)
            filesystem_json = json[:filesystem]
            return unless filesystem_json

            # @todo Check whether the given filesystem can be used for the mount point.
            # @todo Check whether snapshots can be configured and restore to default if needed.

            FromJSONConversions::Filesystem
              .new(filesystem_json, config_builder: config_builder)
              .convert(default)
          end
        end
      end
    end
  end
end
