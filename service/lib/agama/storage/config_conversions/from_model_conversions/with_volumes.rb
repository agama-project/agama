# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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

require "agama/storage/config_conversions/from_model_conversions/partition"
require "agama/storage/config_conversions/from_model_conversions/logical_volume"
require "agama/storage/configs/partition"
require "agama/storage/configs/logical_volume"
require "agama/storage/configs/volume_group"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Mixin for volumes conversion.
        #
        # In this context, volume is a term to refer to partition or logical volume config
        # indiscriminately.
        module WithVolumes
          # @param encryption_model [Hash, nil]
          # @return [Array<Configs::Partition>, Array<Configs::LogicalVolume>]
          def convert_volumes(encryption_model = nil)
            # If the model does not indicate a space policy, then the space policy defined by the
            # product is applied.
            space_policy = model_json[:spacePolicy] || product_config.space_policy

            case space_policy
            when "keep"
              used_volumes_configs(encryption_model)
            when "delete"
              [used_volumes_configs(encryption_model), delete_all_volume_config].flatten
            when "resize"
              [used_volumes_configs(encryption_model), resize_all_volume_config].flatten
            else
              [used_volumes_configs(encryption_model), action_volume_configs].flatten
            end
          end

          # @param encryption_model [Hash, nil]
          # @return [Array<Configs::Partition>, Array<Configs::LogicalVolume>]
          def used_volumes_configs(encryption_model = nil)
            used_volumes.map { |v| convert_volume(v, encryption_model) }
          end

          # @return [Array<Configs::Partition>, Array<Configs::LogicalVolume>]
          def action_volume_configs
            action_volumes.map { |v| convert_volume(v) }
          end

          # Volumes with any usage (format, mount, etc).
          #
          # @return [Array<Hash>]
          def used_volumes
            volumes.reject { |v| space_policy_volume?(v) }
          end

          # Volumes representing a space policy action (delete, resize if needed), excluding
          # the keep actions.
          #
          # Omitting the volumes that only represent a keep action is important. Otherwise, the
          # resulting config would contain a volume without any usage (delete, resize, format,
          # etc) and without a mount path. Such a volume is not supported by the model yet (see
          # {ModelSupportChecker}) and would make impossible to build a model again from the
          # resulting config.
          #
          # @return [Array<Hash>]
          def action_volumes
            volumes
              .select { |v| space_policy_volume?(v) }
              .reject { |v| keep_action_volume?(v)  }
          end

          # @return [Array<Hash>]
          def volumes
            model_json[:partitions] || model_json[:logicalVolumes] || []
          end

          # Whether the volume only represents a space policy action.
          #
          # @param volume [Hash]
          # @return [Boolean]
          def space_policy_volume?(volume)
            delete_action_volume?(volume) ||
              resize_action_volume?(volume) ||
              keep_action_volume?(volume)
          end

          # @param volume [Hash]
          # @return [Boolean]
          def delete_action_volume?(volume)
            volume[:delete] || volume[:deleteIfNeeded]
          end

          # @param volume [Hash]
          # @return [Boolean]
          def resize_action_volume?(volume)
            return false if delete_action_volume?(volume)

            return false if any_usage?(volume)

            volume[:name] && (
              volume[:resizeIfNeeded] ||
                (volume[:size] && !volume.dig(:size, :default))
            )
          end

          # @param volume [Hash]
          # @return [Boolean]
          def keep_action_volume?(volume)
            return false if delete_action_volume?(volume)

            return false if resize_action_volume?(volume)

            return false if any_usage?(volume)

            !volume[:name].nil?
          end

          # TODO: improve check by ensuring the volume is referenced by other device.
          #
          # @param volume [Hash]
          # @return [Boolean]
          def any_usage?(volume)
            volume[:mountPath] || volume[:filesystem]
          end

          # @return [Configs::Partition, Configs::LogicalVolume]
          def delete_all_volume_config
            volume_class.new_for_delete_all
          end

          # @return [Configs::Partition, Configs::LogicalVolume]
          def resize_all_volume_config
            volume_class.new_for_shrink_any_if_needed
          end

          # @param volume [Hash]
          # @param encryption_model [Hash, nil]
          #
          # @return [Configs::Partition, Configs::LogicalVolume]
          def convert_volume(volume, encryption_model = nil)
            return FromModelConversions::LogicalVolume.new(volume).convert if convert_lvm?

            FromModelConversions::Partition.new(volume, bootloader_config, encryption_model).convert
          end

          # Volume config class depending on the conversion.
          def volume_class
            convert_lvm? ? Configs::LogicalVolume : Configs::Partition
          end

          # Whether the conversion if for LVM.
          #
          # @return [Boolean]
          def convert_lvm?
            default_config.is_a?(Configs::VolumeGroup)
          end
        end
      end
    end
  end
end
