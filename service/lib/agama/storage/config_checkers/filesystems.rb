# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/config_checkers/base"
require "agama/storage/proposal_settings_reader"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the overal configuration of filesystems.
      class Filesystems < Base
        include Yast::I18n

        # @param storage_config [Storage::Config]
        # @param product_config [Agama::Config]
        def initialize(storage_config, product_config)
          super()

          textdomain "agama"
          @storage_config = storage_config
          @product_config = product_config
        end

        # Issues related to the configured set of filesystems.
        #
        # @return [Array<Issue>]
        def issues
          [missing_paths_issue].compact
        end

      private

        # @return [Storage::Config]
        attr_reader :storage_config

        # @return [Agama::Config]
        attr_reader :product_config

        # @return [Issue, nil]
        def missing_paths_issue
          missing_paths = mandatory_paths.reject { |p| configured_path?(p) }
          return if missing_paths.empty?

          error(
            format(
              # TRANSLATORS: %s is a path like "/" or a list of paths separated by commas
              n_(
                "A separate file system for %s is required.",
                "Separate file systems are required for the following paths: %s",
                missing_paths.size
              ),
              missing_paths.join(", ")
            ),
            kind: IssueClasses::Config::REQUIRED_PATHS
          )
        end

        # @return [Boolean]
        def configured_path?(path)
          filesystems.any? { |fs| fs.path?(path) }
        end

        # @return [Array<Configs::Filesystem>]
        def filesystems
          @filesystems ||= storage_config.filesystems
        end

        # @return [Array<String>]
        def mandatory_paths
          product_config.mandatory_paths
        end
      end
    end
  end
end
