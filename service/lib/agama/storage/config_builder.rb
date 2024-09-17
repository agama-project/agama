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

require "agama/storage/configs"
require "agama/storage/proposal_settings_reader"
require "agama/storage/volume_templates_builder"

module Agama
  module Storage
    # Class for building configs.
    class ConfigBuilder
      # @todo Replace product_config param by a ProductDefinition.
      #
      # @param product_config [Agama::Config]
      def initialize(product_config)
        @product_config = product_config
      end

      # Default encryption config from the product definition.
      #
      # @return [Configs::Encryption]
      def default_encryption
        Configs::Encryption.new.tap do |config|
          config.password = settings.encryption.password
          config.method = settings.encryption.method
          config.pbkd_function = settings.encryption.pbkd_function
        end
      end

      # Default format config from the product definition.
      #
      # @param path [String, nil]
      # @return [Configs::Filesystem]
      def default_filesystem(path = nil)
        Configs::Filesystem.new.tap do |config|
          config.type = default_fstype(path)
        end
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # Default filesystem type config from the product definition.
      #
      # @param path [String, nil]
      # @return [Configs::FilesystemType]
      def default_fstype(path = nil)
        volume = volume_builder.for(path || "")

        Configs::FilesystemType.new.tap do |config|
          config.fs_type = volume.fs_type
          config.btrfs = volume.btrfs
        end
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
