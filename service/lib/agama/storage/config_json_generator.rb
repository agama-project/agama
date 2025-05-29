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

module Agama
  module Storage
    # Config JSON generator.
    class ConfigJSONGenerator
      # @param product_config [Agama::Config]
      # @param device [Y2Storage::BlkDevice, nil] Target device for the installation.
      def initialize(product_config, device: nil)
        @product_config = product_config
        @device = device
      end

      # Generates a JSON config according to the product and the target device.
      #
      # @return [Hash]
      def generate
        product_config.lvm? ? lvm_config : partitionable_config
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Y2Storage::BlkDevice, nil]
      attr_reader :device

      # Default config when the target is a partitionable device.
      #
      # @return [Hash]
      def partitionable_config
        {
          target_section => [
            {
              search:     device&.name,
              partitions: [partition_for_existing, volumes_generator].compact
            }
          ]
        }
      end

      # Default config when the target is a volume group.
      #
      # @return [Hash]
      def lvm_config
        target_config("system-target").merge(
          {
            volumeGroups: [
              {
                name:            "system",
                physicalVolumes: [{ generate: ["system-target"] }],
                logicalVolumes:  [volumes_generator]
              }
            ]
          }
        )
      end

      # Config for a device used as target by other device (e.g., for creating physical volumes).
      #
      # @param device_alias [String] Alias to use for referring to this target config.
      # @return [Hash]
      def target_config(device_alias)
        {
          target_section => [
            {
              alias:      device_alias,
              search:     device&.name,
              partitions: [partition_for_existing].compact
            }
          ]
        }
      end

      # Section name depending on the target device for installation.
      #
      # @return [String]
      def target_section
        return :mdRaids if device&.is?(:software_raid)

        :drives
      end

      # JSON piece to generate default filesystems as partitions or logical volumes.
      #
      # @return [Hash]
      def volumes_generator
        { generate: "default" }
      end

      # JSON piece to specify what to do with existing partitions.
      #
      # @return [Hash, nil] nil if no actions are to be performed.
      def partition_for_existing
        space_policy = product_config.space_policy
        return unless ["delete", "resize"].include?(space_policy)

        partition = { search: "*" }

        if space_policy == "delete"
          partition[:delete] = true
        else
          partition[:size] = { min: 0, max: "current" }
        end

        partition
      end
    end
  end
end
