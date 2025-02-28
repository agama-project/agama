# frozen_string_literal: true

# Copyright (c) [2024-2025] SUSE LLC
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
require "agama/storage/config_conversions/to_model_conversions/boot"
require "agama/storage/config_conversions/to_model_conversions/encryption"
require "agama/storage/config_conversions/to_model_conversions/drive"
require "agama/storage/config_conversions/to_model_conversions/volume_group"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Config conversion to model according to the JSON schema.
        class Config < Base
          # @param config [Storage::Config]
          def initialize(config)
            super()
            @config = config
          end

        private

          # @see Base#conversions
          def conversions
            {
              boot:         convert_boot,
              encryption:   convert_encryption,
              drives:       convert_drives,
              volumeGroups: convert_volume_groups
            }
          end

          # @return [Hash]
          def convert_boot
            ToModelConversions::Boot.new(config).convert
          end

          # @return [Hash]
          def convert_encryption
            encryption = base_encryption
            return unless encryption

            ToModelConversions::Encryption.new(encryption).convert
          end

          # @return [Array<Hash>]
          def convert_drives
            valid_drives.map { |d| ToModelConversions::Drive.new(d).convert }
          end

          # @return [Array<Hash>]
          def convert_volume_groups
            config.volume_groups.map { |v| ToModelConversions::VolumeGroup.new(v).convert }
          end

          # @return [Array<Configs::Drive>]
          def valid_drives
            config.drives.select(&:found_device)
          end

          # TODO: proper support for a base encryption.
          #   The current implementation is a temporary solution which assumes that all the
          #   partitions are encrypted in the very same way (encryption method, password, etc).
          #
          # Detects the base encryption.
          #
          # @return [Configs::Encryption, nil] nil if there is no encrypted partition.
          def base_encryption
            root_encryption || first_encryption
          end

          # Encryption from root partition.
          #
          # @return [Configs::Encryption, nil] nil if there is no encryption for root partition.
          def root_encryption
            root_partition = config.partitions.find { |p| p.filesystem&.root? }
            root_partition&.encryption
          end

          # Encryption from the first encrypted partition.
          #
          # @return [Configs::Encryption, nil] nil if there is no encrypted partition.
          def first_encryption
            config.partitions.find(&:encryption)&.encryption
          end
        end
      end
    end
  end
end
