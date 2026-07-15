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

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Drive conversion to model according to the JSON schema.
        class Filesystem < Base
          # @param config [Configs::Filesystem]
          # @param volumes [VolumeTemplatesBuilder]
          # @param found_device [Y2Storage::BlkDevice, nil]
          def initialize(config, volumes, found_device = nil)
            super()
            @config = config
            @volumes = volumes
            @found_device = found_device
          end

        private

          # @return [VolumeTemplatesBuilder]
          attr_reader :volumes

          # @return [Y2Storage::BlkDevice, nil]
          attr_reader :found_device

          # @see Base#conversions
          def conversions
            {
              reuse:              reuse?,
              default:            convert_default,
              type:               convert_type,
              label:              config.label,
              mkfsExtraArguments: config.mkfs_args,
              mountOptions:       convert_mount_options
            }
          end

          # Checks whether reusing is wanted and looks possible
          #
          # FIXME: For consistency with other properties, the config solver should decide whether
          # an existing filesystem is indeed going to be reused and should reflect that in the
          # Config object. Thus, this would only expose that information directly.
          # Right now, this includes temporary logic to cover the case in which reuseIfPossible is
          # set to true but no filesystem will actually be reused.
          #
          # @return [Boolean]
          def reuse?
            config.reuse? && can_reuse?
          end

          # @return [Boolean]
          def can_reuse?
            !!found_device&.formatted?
          end

          # @return [Boolean, nil]
          def convert_default
            return unless config.type

            config.type.default?
          end

          # Converts the type, including some conversions needed for correct UI representation
          #
          # FIXME: For consistency with other properties, the config solver should decide whether
          # the filesystem is indeed going to be reused and should adjust Configs::Filesystem#type
          # to reflect the final value. Thus, this should be a direct transformation of that value.
          # As a temporary solution, this code guesses whether reuseIfPossible is going to be
          # honored and tries to display the final filesystem type.
          #
          # @return [String, nil]
          def convert_type
            return found_device.filesystem.type.to_s if reuse?

            return unless config.type&.fs_type

            if config.type.fs_type.is?(:btrfs)
              return "btrfsImmutable" if immutable?
              return "btrfsSnapshots" if snapshots?
            end

            config.type.fs_type.to_s
          end

          # @return [Array<String>, nil]
          def convert_mount_options
            return if config.mount_options.empty?

            config.mount_options
          end

          # @return [Boolean]
          def snapshots?
            !!config.type.btrfs&.snapshots?
          end

          # @return [Boolean]
          def immutable?
            return false unless config.path

            volume = volumes.for(config.path)
            return false unless volume

            !!volume.btrfs&.read_only?
          end
        end
      end
    end
  end
end
