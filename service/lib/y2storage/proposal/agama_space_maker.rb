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

require "y2storage/proposal/space_maker"
require "y2storage/proposal_settings"

module Y2Storage
  module Proposal
    # Space maker for Agama.
    class AgamaSpaceMaker < SpaceMaker
      # @param disk_analyzer [DiskAnalyzer]
      # @param config [Agama::Storage::Config]
      def initialize(disk_analyzer, config)
        super(disk_analyzer, guided_settings(config))
      end

    private

      # Method used by the constructor to somehow simulate a typical Guided Proposal
      #
      # @param config [Agama::Storage::Config]
      def guided_settings(config)
        # Despite the "current_product" part in the name of the constructor, it only applies
        # generic default values that are independent of the product (there is no YaST
        # ProductFeatures mechanism in place).
        Y2Storage::ProposalSettings.new_for_current_product.tap do |target|
          target.space_settings.strategy = :bigger_resize
          target.space_settings.actions = space_actions(config)

          boot_device = config.boot_device

          target.root_device = boot_device
          target.candidate_devices = [boot_device].compact
        end
      end

      # Space actions from the given config.
      #
      # @param config [Agama::Storage::Config]
      # @return [Hash]
      def space_actions(config)
        actions = force_delete_actions(config)
        actions.concat(delete_actions(config))
        actions.concat(resize_actions(config))
      end

      # Space actions for devices that must be deleted.
      #
      # @param config [Agama::Storage::Config]
      # @return [Array<Y2Storage::SpaceActions::Delete>]
      def force_delete_actions(config)
        partition_configs = partitions(config).select(&:delete?)
        partition_names = device_names(partition_configs)

        partition_names.map { |p| Y2Storage::SpaceActions::Delete.new(p, mandatory: true) }
      end

      # Space actions for devices that might be deleted.
      #
      # @note #delete? takes precedence over #delete_if_needed?.
      #
      # @param config [Agama::Storage::Config]
      # @return [Array<Y2Storage::SpaceActions::Delete>]
      def delete_actions(config)
        partition_configs = partitions(config).select(&:delete_if_needed?).reject(&:delete?)
        partition_names = device_names(partition_configs)

        partition_names.map { |p| Y2Storage::SpaceActions::Delete.new(p) }
      end

      # Space actions for devices that might be resized
      #
      # @param config [Agama::Storage::Config]
      # @return [Array<Y2Storage::SpaceActions::Resize>]
      def resize_actions(config)
        partition_configs = partitions(config).select(&:found_device).select(&:size)
        partition_configs.map do |part|
          # Resize actions contain information that is potentially useful for the SpaceMaker even
          # when they are only about growing and not shrinking
          min = current_size?(part, :min) ? nil : part.size.min
          max = current_size?(part, :max) ? nil : part.size.max
          Y2Storage::SpaceActions::Resize.new(part.found_device.name, min_size: min, max_size: max)
        end.compact
      end

      # @see #resize_actions
      def current_size?(part, attr)
        part.found_device.size == part.size.public_send(attr)
      end

      # All partition configs from the given config.
      #
      # @param config [Agama::Storage::Config]
      # @return [Array<Agama::Storage::Configs::Partition>]
      def partitions(config)
        config.drives.flat_map(&:partitions)
      end

      # Device names from the given configs.
      #
      # @param configs [Array<#found_device>]
      # @return [Array<String>]
      def device_names(configs)
        configs
          .map(&:found_device)
          .compact
          .map(&:name)
      end
    end
  end
end
