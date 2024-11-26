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

require "agama/storage/config_conversions/to_model_conversions/base"
require "agama/storage/configs/filesystem"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Drive conversion to model according to the JSON schema.
        class Filesystem < Base
          # @see Base
          def self.config_type
            Configs::Filesystem
          end

        private

          # @see Base#conversions
          def conversions
            {
              default:   convert_default,
              type:      convert_type,
              snapshots: convert_snapshots
            }
          end

          # @return [Boolean, nil]
          def convert_default
            return unless config.type

            config.type.default?
          end

          # @return [String, nil]
          def convert_type
            return unless config.type&.fs_type

            config.type.fs_type.to_s
          end

          # @return [Boolean, nil]
          def convert_snapshots
            return unless config.type&.fs_type&.is?(:btrfs)

            config.type.btrfs&.snapshots?
          end
        end
      end
    end
  end
end
