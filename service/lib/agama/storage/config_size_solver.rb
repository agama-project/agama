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

require "agama/storage/configs/size"
require "agama/storage/config_builder"

module Agama
  module Storage
    # Solver for the size configs.
    #
    # It assigns proper size values according to the product and the system.
    class ConfigSizeSolver
      # @param devicegraph [Y2Storage::Devicegraph]
      # @param product_config [Agama::Config]
      def initialize(devicegraph, product_config)
        @devicegraph = devicegraph
        @product_config = product_config
      end

      # Solves all the size configs within a given config.
      #
      # @note The config object is modified.
      #
      # @param config [Config]
      def solve(config)
        @config = config

        solve_default_sizes
        solve_current_sizes
      end

    private

      # @return [Y2Storage::Devicegraph]
      attr_reader :devicegraph

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Config]
      attr_reader :config

      def solve_default_sizes
        configs_with_default_product_size.each { |c| solve_default_product_size(c) }
        configs_with_default_device_size.each { |c| solve_default_device_size(c) }
      end

      def solve_current_sizes
        configs_with_valid_current_size.each { |c| solve_current_size(c) }
        configs_with_invalid_current_size.each { |c| solve_default_product_size(c) }
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      def solve_default_product_size(config)
        config.size = size_from_product(config)
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      def solve_default_device_size(config)
        config.size = size_from_device(config.found_device)
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      def solve_current_size(config)
        min = config.size.min
        max = config.size.max
        size = size_from_device(config.found_device)
        size.min = min if min
        size.max = max if max
        config.size = size
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      # @return [Configs::Size]
      def size_from_product(config)
        path = config.filesystem&.path
        snapshots = config.filesystem&.btrfs_snapshots?

        paths = configs_with_filesystem
          .map(&:filesystem)
          .compact
          .map(&:path)
          .compact

        config_builder.default_size(path, having_paths: paths, with_snapshots: snapshots)
      end

      # @param device [Y2Storage::Device]
      # @return [Configs::Size]
      def size_from_device(device)
        Configs::Size.new.tap do |config|
          config.default = false
          config.min = device.size
          config.max = device.size
        end
      end

      # @return [Array<Configs::Partition, Configs::LogicalVolume>]
      def configs_with_size
        configs = config.partitions + config.logical_volumes
        configs.select { |c| valid?(c) }
      end

      # @return [Array<Configs::Drive, Configs::Partition, Configs::LogicalVolume>]
      def configs_with_filesystem
        configs = config.drives + config.partitions + config.logical_volumes
        configs.select { |c| valid?(c) }
      end

      # @return [Array<Configs::Partition, Configs::LogicalVolume>]
      def configs_with_default_product_size
        configs_with_size.select { |c| with_default_product_size?(c) }
      end

      # @return [Array<Configs::Partition, Configs::LogicalVolume>]
      def configs_with_default_device_size
        configs_with_size.select { |c| with_default_device_size?(c) }
      end

      # @return [Array<Configs::Partition, Configs::LogicalVolume>]
      def configs_with_valid_current_size
        configs_with_size.select { |c| with_valid_current_size?(c) }
      end

      # @return [Array<Configs::Partition, Configs::LogicalVolume>]
      def configs_with_invalid_current_size
        configs_with_size.select { |c| with_invalid_current_size?(c) }
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def with_default_product_size?(config)
        config.size.default? && create_device?(config)
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def with_default_device_size?(config)
        config.size.default? && reuse_device?(config)
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def with_valid_current_size?(config)
        with_current_size?(config) && reuse_device?(config)
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def with_invalid_current_size?(config)
        with_current_size?(config) && create_device?(config)
      end

      # @param config [Configs::Partition, Configs::LogicalVolume]
      # @return [Boolean]
      def with_current_size?(config)
        !config.size.default? && (config.size.min.nil? || config.size.max.nil?)
      end

      # Whether the config has to be considered.
      #
      # Note that a config could be ignored if a device is not found for its search.
      #
      # @param config [Object] Any config from {Configs}.
      # @return [Boolean]
      def valid?(config)
        create_device?(config) || reuse_device?(config)
      end

      # @param config [Object] Any config from {Configs}.
      # @return [Boolean]
      def create_device?(config)
        return true unless config.respond_to?(:search)

        config.search.nil? || config.search.create_device?
      end

      # @param config [Object] Any config from {Configs}.
      # @return [Boolean]
      def reuse_device?(config)
        return false unless config.respond_to?(:found_device)

        !config.found_device.nil?
      end

      # @return [ConfigBuilder]
      def config_builder
        @config_builder ||= ConfigBuilder.new(product_config)
      end
    end
  end
end
