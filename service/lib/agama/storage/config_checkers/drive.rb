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

require "agama/storage/config_checkers/base"
require "agama/storage/config_checkers/with_alias"
require "agama/storage/config_checkers/with_encryption"
require "agama/storage/config_checkers/with_filesystem"
require "agama/storage/config_checkers/with_partitions"
require "agama/storage/config_checkers/with_search"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking a drive config.
      class Drive < Base
        include WithAlias
        include WithEncryption
        include WithFilesystem
        include WithPartitions
        include WithSearch

        # @param config [Configs::Drive]
        # @param storage_config [Storage::Config]
        # @param product_config [Agama::Config]
        def initialize(config, storage_config, product_config)
          super()

          @config = config
          @storage_config = storage_config
          @product_config = product_config
        end

        # Drive config issues.
        #
        # @return [Array<Issue>]
        def issues
          [
            alias_issues,
            search_issues,
            filesystem_issues,
            encryption_issues,
            partitions_issues
          ].flatten
        end

      private

        # @return [Configs::Drive]
        attr_reader :config

        # @return [Storage::Config]
        attr_reader :storage_config

        # @return [Agama::Config]
        attr_reader :product_config
      end
    end
  end
end
