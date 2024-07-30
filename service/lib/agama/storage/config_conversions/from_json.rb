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

require "agama/storage/config"
require "agama/storage/config_conversions/drive/from_json"
require "agama/storage/configs/boot"
require "agama/storage/proposal_settings_reader"

module Agama
  module Storage
    module ConfigConversions
      # Config conversion from JSON hash according to schema.
      #
      # TODO: The approach for generating a Config from JSON could be improved:
      #   * All the FromJSON classes receive only a JSON and an optional default config to start
      #     converting from it.
      #   * There should be a "config generator" class which knows the ProductDefinition and creates
      #     config objects calling to the proper FromJSON classes, passing the default config for
      #     each case (drive, partition, etc).
      #
      #   For example:
      #
      #   def generate_drive(drive_json)
      #     default = default_drive(drive_json.dig(:filesystem, :path))
      #     drive = Drive::FromJson.new(drive_json).convert(default)
      #     drive.partitions = drive_json[:partitions].map do |partition_json|
      #       default = default_partition(partition_json.dig(:fileystem, :path))
      #       Partition::FromJSON.new(partition_json).convert(default)
      #     end
      #     drive
      #   end
      #
      #   This improvement could be done at the time of introducing the ProductDefinition class.
      class FromJSON
        # @todo Replace product_config param by a ProductDefinition.
        #
        # @param config_json [Hash]
        # @param product_config [Agama::Config]
        def initialize(config_json, product_config:)
          @config_json = config_json
          @product_config = product_config
        end

        # Performs the conversion from Hash according to the JSON schema.
        #
        # @return [Storage::Config]
        def convert
          # @todo Raise error if config_json does not match the JSON schema.
          Storage::Config.new.tap do |config|
            boot = convert_boot
            drives = convert_drives

            config.boot = boot if boot
            config.drives = drives if drives
            config.calculate_default_sizes(volume_builder)
          end
        end

      private

        # @return [Hash]
        attr_reader :config_json

        # @return [Agama::Config]
        attr_reader :product_config

        # @return [Configs::Boot, nil]
        def convert_boot
          boot_json = config_json[:boot]
          return unless boot_json

          Configs::Boot.new.tap do |config|
            config.configure = boot_json[:configure]
            config.device = boot_json[:device]
          end
        end

        # @return [Array<Configs::Drive>, nil]
        def convert_drives
          drives_json = config_json[:drives]
          return unless drives_json

          drives_json.map { |d| convert_drive(d) }
        end

        # @return [Configs::Drive]
        def convert_drive(drive_json)
          Drive::FromJSON.new(drive_json,
            settings: settings, volume_builder: volume_builder).convert
        end

        # @return [ProposalSettings]
        def settings
          @settings ||= ProposalSettingsReader.new(product_config).read
        end

        # @return [VolumeTemplatesBuilder]
        def volume_builder
          @volume_builder ||= VolumeTemplatesBuilder.new_from_config(product_config)
        end
      end
    end
  end
end
