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

require "agama/config"
require "agama/storage/volume_templates_builder"

module Agama
  module Storage
    # Class for solving a storage JSON config.
    #
    # A storage JSON config can contain a "generate" section for automatically generating partitions
    # or logical volumes according to the indicated default and mandatory paths. The "generate"
    # section is solved by replacing it with the corresponding configs. The solver takes into
    # account other paths already present in the rest of the config.
    #
    # @example
    #   config_json = {
    #     drives: [
    #       {
    #         generate: "default"
    #       },
    #       {
    #         filesystem: { path: "swap" }
    #       }
    #     ]
    #   }
    #
    #   ConfigJSONSolver.new(product_config).solve(config_json)
    #   config_json # =>  {
    #                       drives: [
    #                         {
    #                           filesystem: { path: "/" }
    #                         },
    #                         {
    #                           filesystem: { path: "/home" }
    #                         },
    #                         {
    #                           filesystem: { path: "swap" }
    #                         }
    #                       ]
    #                     }
    class ConfigJSONSolver
      # @param default_paths [Array<String>] Default paths of the product.
      # @param mandatory_paths [Array<String>] Mandatory paths of the product.
      def initialize(default_paths: [], mandatory_paths: [])
        @default_paths = default_paths
        @mandatory_paths = mandatory_paths
      end

      # Solves the generate section within a given JSON config.
      #
      # @note The config_json object is modified.
      #
      # @param config_json [Hash]
      def solve(config_json)
        @config_json = config_json

        solve_indexes
        solve_generate
      end

    private

      # @return [Array<String>]
      attr_reader :default_paths

      # @return [Array<String>]
      attr_reader :mandatory_paths

      # @return [Hash]
      attr_reader :config_json

      def solve_indexes
        drives = config_json[:drives] || []
        assign_indexes(drives)
        drives.each { |d| assign_indexes(d[:partitions] || []) }

        volume_groups = config_json[:volumeGroups] || []
        assign_indexes(volume_groups)
        volume_groups.each { |d| assign_indexes(d[:logicalVolumes] || []) }
      end

      def assign_indexes(configs)
        configs.each_with_index { |c, i| c[:index] = i }
      end

      def solve_generate
        configs = configs_with_generate
        return unless configs.any?

        expand_generate(configs.first)
        configs.each { |c| remove_generate(c) }
      end

      # @param config [Hash] Drive or volume group config (e.g., { partitions: [...] }).
      def expand_generate(config)
        configs = volume_configs(config)
        generate_config = configs.find { |c| with_generate?(c) }

        return unless generate_config

        current_index = configs.index(generate_config)
        index = generate_config[:index] || current_index

        configs[current_index] = volumes_from_generate(generate_config)
          .each { |c| c[:index] = index }

        configs.flatten!
      end

      # @param config [Hash] e.g., { partitions: [...] }
      def remove_generate(config)
        volume_configs(config).delete_if { |c| with_generate?(c) }
      end

      # @param config [Hash] Generate config (e.g., { generate: "default" }).
      def volumes_from_generate(config)
        if with_generate_default?(config)
          missing_default_volumes(config)
        elsif with_generate_mandatory?(config)
          missing_mandatory_volumes(config)
        end
      end

      # @param config [Hash] e.g., { generate: "default" }
      # @return [Array<Hash>]
      def missing_default_volumes(config)
        missing_default_paths.map { |p| volume_from_generate(config, p) }
      end

      # @return [Array<String>]
      def missing_default_paths
        default_paths - current_paths
      end

      # @return [Array<String>]
      def current_paths
        configs_with_filesystem
          .select { |c| c.is_a?(Hash) }
          .map { |c| c.dig(:filesystem, :path) }
          .compact
      end

      # @param config [Hash] e.g., { generate: "default" }
      # @return [Array<Hash>]
      def missing_mandatory_volumes(config)
        missing_mandatory_paths.map { |p| volume_from_generate(config, p) }
      end

      # @return [Array<String>]
      def missing_mandatory_paths
        mandatory_paths - current_paths
      end

      # @param config [Hash] e.g., { generate: "default" }
      # @param path [String]
      #
      # @return [Hash]
      def volume_from_generate(config, path)
        volume = { filesystem: { path: path } }

        return volume unless config[:generate].is_a?(Hash)

        generate = config[:generate]
        generate.delete(:partitions)
        generate.delete(:logicalVolumes)

        volume.merge(generate)
      end

      # @return [Array<Hash>]
      def configs_with_generate
        configs = drive_configs + volume_group_configs
        configs.select { |c| with_volume_generate?(c) }
      end

      # @return [Array<Hash>]
      def configs_with_filesystem
        drive_configs + partition_configs + logical_volume_configs
      end

      # @return [Array<Hash>]
      def drive_configs
        config_json[:drives] || []
      end

      # @return [Array<Hash>]
      def volume_group_configs
        config_json[:volumeGroups] || []
      end

      # @return [Array<Hash>]
      def partition_configs
        drive_configs = config_json[:drives]
        return [] unless drive_configs

        drive_configs
          .flat_map { |c| c[:partitions] }
          .compact
      end

      # @return [Array<Hash>]
      def logical_volume_configs
        volume_group_configs = config_json[:volumeGroups]
        return [] unless volume_group_configs

        volume_group_configs
          .flat_map { |c| c[:logicalVolumes] }
          .compact
      end

      # @param config [Hash] e.g., { partitions: [...] }
      # @return [Array<Hash>]
      def volume_configs(config)
        config[:partitions] || config[:logicalVolumes] || []
      end

      # @param config [Hash] e.g., { partitions: [...] }
      # @return [Boolean]
      def with_volume_generate?(config)
        volume_configs(config).any? { |c| with_generate?(c) }
      end

      # @param config [Hash]
      # @return [Booelan]
      def with_generate?(config)
        !config[:generate].nil?
      end

      # @param config [Hash]
      # @return [Booelan]
      def with_generate_default?(config)
        with_generate_value?(config, "default")
      end

      # @param config [Hash]
      # @return [Booelan]
      def with_generate_mandatory?(config)
        with_generate_value?(config, "mandatory")
      end

      # @param config [Hash]
      # @param value [String]
      #
      # @return [Booelan]
      def with_generate_value?(config, value)
        generate = config[:generate]

        return generate == value unless generate.is_a?(Hash)

        generate[:partitions] == value || generate[:logicalVolumes] == value
      end
    end
  end
end
