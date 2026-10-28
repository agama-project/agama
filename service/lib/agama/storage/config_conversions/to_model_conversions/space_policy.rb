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

require "agama/storage/configs/volume_group"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Space policy conversion to model according to the JSON schema.
        class SpacePolicy
          # @param config [Configs::Drive, Configs::MdRaid, Configs::VolumeGroup]
          def initialize(config)
            @config = config
          end

          # @return [String]
          def convert
            return "delete" if delete_all_volumes?
            return "resize" if shrink_all_volumes?
            return "custom" if delete_volume? || resize_volume?

            "keep"
          end

        private

          # @return [Configs::Drive, Configs::MdRaid, Configs::VolumeGroup]
          attr_reader :config

          # Volumes from the config.
          #
          # In this context, volume is a term to refer to partition or logical volume config
          # indiscriminately.
          #
          # @return [Array<Configs::Partition>, Array<Configs::LogicalVolume>]
          def volumes
            config.is_a?(Configs::VolumeGroup) ? config.logical_volumes : config.partitions
          end

          # @return [Boolean]
          def delete_all_volumes?
            volumes.any? { |v| delete_all?(v) }
          end

          # @return [Boolean]
          def shrink_all_volumes?
            volumes.any? { |v| shrink_all?(v) }
          end

          # @return [Boolean]
          def delete_volume?
            volumes
              .select(&:found_device)
              .any? { |v| v.delete? || v.delete_if_needed? }
          end

          # @return [Boolean]
          def resize_volume?
            volumes
              .select(&:found_device)
              .any? { |v| !v.size.default? }
          end

          # @param volume [Configs::Partition, Configs::LogicalVolume]
          # @return [Boolean]
          def delete_all?(volume)
            search_all?(volume) && volume.delete?
          end

          # @param volume [Configs::Partition, Configs::LogicalVolume]
          # @return [Boolean]
          def shrink_all?(volume)
            search_all?(volume) &&
              !volume.size.nil? &&
              !volume.size.min.nil? &&
              volume.size.min.to_i == 0
          end

          # @param volume [Configs::Partition, Configs::LogicalVolume]
          # @return [Boolean]
          def search_all?(volume)
            !volume.search.nil? &&
              !volume.search.condition? &&
              volume.search.max.nil?
          end
        end
      end
    end
  end
end
