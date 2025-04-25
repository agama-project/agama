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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/config_conversions/from_json_conversions/with_encryption"
require "agama/storage/config_conversions/from_json_conversions/with_filesystem"
require "agama/storage/config_conversions/from_json_conversions/with_partitions"
require "agama/storage/config_conversions/from_json_conversions/with_ptable_type"
require "agama/storage/configs/md_raid"
require "y2storage/disk_size"
require "y2storage/md_level"
require "y2storage/md_parity"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # MD RAID conversion from JSON hash according to schema.
        class MdRaid < Base
        private

          include WithEncryption
          include WithFilesystem
          include WithPtableType
          include WithPartitions

          alias_method :md_raid_json, :config_json

          # @see Base
          # @return [Configs::MdRaid]
          def default_config
            Configs::MdRaid.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              name:        md_raid_json[:name],
              alias:       md_raid_json[:alias],
              level:       convert_level,
              parity:      convert_parity,
              chunk_size:  convert_chunk_size,
              devices:     md_raid_json[:devices],
              encryption:  convert_encryption,
              filesystem:  convert_filesystem,
              ptable_type: convert_ptable_type,
              partitions:  convert_partitions
            }
          end

          # @return [Y2Storage::MdParity, nil]
          def convert_parity
            value = md_raid_json[:parity]
            return unless value && md_parity_values.include?(value)

            Y2Storage::MdParity.find(value)
          end

          # @return [Y2Storage::MdLevel, nil]
          def convert_level
            value = md_raid_json[:level]
            return unless value && md_level_values.include?(value)

            Y2Storage::MdLevel.find(value)
          end

          # @return [Y2Storage::DiskSize, nil]
          def convert_chunk_size
            value = md_raid_json[:chunkSize]
            return unless value

            Y2Storage::DiskSize.new(value)
          end

          # @return [Array<String>]
          def md_parity_values
            @md_parity_values ||= Y2Storage::MdParity.all.map(&:to_s)
          end

          # @return [Array<String>]
          def md_level_values
            @md_level_values ||= Y2Storage::MdLevel.all.map(&:to_s)
          end
        end
      end
    end
  end
end
