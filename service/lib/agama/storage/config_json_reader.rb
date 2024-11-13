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

module Agama
  module Storage
    # Reader for the initial JSON config.
    class ConfigJSONReader
      # @param product_config [Agama::Config]
      def initialize(product_config)
        @product_config = product_config
      end

      # Generates a JSON config from the product config.
      #
      # @return [Hash]
      def read
        json = product_config.lvm? ? json_for_lvm : json_for_disk

        { storage: json }
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # @see #read
      # @return [Hash]
      def json_for_disk
        {
          drives: [
            { partitions: [partition_for_existing, volumes_generator].compact }
          ]
        }
      end

      # @see #read
      # @return [Hash]
      def json_for_lvm
        partition = partition_for_existing

        drive = { alias: "target" }
        drive[:partitions] = [partition] if partition

        {
          drives:       [drive],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: [{ generate: ["target"] }],
              logicalVolumes:  [volumes_generator]
            }
          ]
        }
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
