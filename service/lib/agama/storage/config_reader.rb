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

require "agama/storage/config_conversions"

module Agama
  module Storage
    # Reader for the initial storage config
    class ConfigReader
      # @param agama_config [Agama::Config]
      def initialize(agama_config)
        @agama_config = agama_config
      end

      # Generates a storage config from the Agama control file.
      #
      # @return [Storage::Config]
      def read
        ConfigConversions::FromJSON.new(json, default_paths: default_paths).convert
      end

    private

      # @return [Agama::Config]
      attr_reader :agama_config

      # Default filesystem paths from the Agama control file
      #
      # @return [Array<String>]
      def default_paths
        @default_paths ||= agama_config.default_paths
      end

      # Default policy to make space from the Agama control file
      #
      # @return [String]
      def space_policy
        @space_policy ||= agama_config.data.dig("storage", "space_policy")
      end

      # Whether the Agama control file specifies that LVM must be used by default
      #
      # @return [Boolean]
      def lvm?
        return @lvm unless @lvm.nil?

        @lvm = !!agama_config.data.dig("storage", "lvm")
      end

      # JSON representation of the initial storage config
      #
      # @return [Hash]
      def json
        lvm? ? json_for_lvm : json_for_disk
      end

      # @see #json
      #
      # @return [Hash]
      def json_for_disk
        {
          drives: [
            { partitions: [partition_for_existing, volumes_generator].compact }
          ]
        }
      end

      # @see #json
      #
      # @return [Hash]
      def json_for_lvm
        {
          drives:       [
            {
              alias:      "target",
              partitions: [partition_for_existing].compact
            }
          ],
          volumeGroups: [
            {
              name:            "system",
              physicalVolumes: [{ generate: ["target"] }],
              logicalVolumes:  [volumes_generator]
            }
          ]
        }
      end

      # JSON piece to generate default filesystems as partitions or logical volumes
      #
      # @return [Hash]
      def volumes_generator
        { generate: "default" }
      end

      # JSON piece to specify what to do with existing partitions
      #
      # @return [Hash, nil] nil if no actions are to be performed
      def partition_for_existing
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
