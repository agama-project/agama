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
    #
    # FIXME: this class must dissappear. It does not implement any own logic compared to the
    # original SpaceMaker. It simply encapsulates the conversion from Agama config to
    # ProposalSpaceSettings.
    class AgamaSpaceMaker < SpaceMaker
      # @param disk_analyzer [DiskAnalyzer]
      # @param config [Agama::Storage::Config]
      def initialize(disk_analyzer, config)
        super(disk_analyzer, space_settings(config))
      end

    private

      # Method used by the constructor to convert the Agama config to ProposalSpaceSettings
      #
      # @param config [Agama::Storage::Config]
      def space_settings(config)
        Y2Storage::ProposalSpaceSettings.new.tap do |target|
          target.strategy = :bigger_resize
          target.actions = space_actions(config)
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
        # Resize actions contain information that is potentially useful for the SpaceMaker even
        # when they are only about growing and not shrinking
        partition_configs.map { |p| resize_action(p) }.compact
      end

      # @see #resize_actions
      #
      # @param part [Agama::Storage::Configs::Partition]
      # @return [Y2Storage::SpaceActions::Resize, nil]
      def resize_action(part)
        min = current_size?(part, :min) ? nil : part.size.min
        max = current_size?(part, :max) ? nil : part.size.max
        # If both min and max are equal to the current device size, there is nothing to do
        return unless min || max

        Y2Storage::SpaceActions::Resize.new(part.found_device.name, min_size: min, max_size: max)
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
