# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/storage/config_conversions/to_model_conversions/with_filesystem"
require "agama/storage/config_conversions/to_model_conversions/with_partitions"
require "agama/storage/config_conversions/to_model_conversions/with_space_policy"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # MD RAID conversion to model according to the JSON schema.
        class MdRaid < Base
          include WithFilesystem
          include WithPartitions
          include WithSpacePolicy

          # @param config [Configs::MdRaid]
          # @param volumes [VolumeTemplatesBuilder]
          def initialize(config, volumes)
            super()
            @config = config
            @volumes = volumes
          end

        private

          # @return [VolumeTemplatesBuilder]
          attr_reader :volumes

          # @see Base#conversions
          def conversions
            {
              name:        config.device_name,
              mountPath:   config.filesystem&.path,
              filesystem:  convert_filesystem,
              spacePolicy: convert_space_policy,
              ptableType:  config.ptable_type&.to_s,
              partitions:  convert_partitions
            }
          end
        end
      end
    end
  end
end
