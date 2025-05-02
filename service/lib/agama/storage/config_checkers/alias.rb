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
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking a config with alias.
      class Alias < Base
        include Yast::I18n

        # @param config [#alias]
        # @param storage_config [Storage::Config]
        def initialize(config, storage_config)
          super()

          textdomain "agama"
          @config = config
          @storage_config = storage_config
        end

        # Alias related issues.
        #
        # @return [Array<Issue>]
        def issues
          [overused_alias_issue].compact
        end

      private

        # @return [#filesystem]
        attr_reader :config

        # @return [Storage::Config]
        attr_reader :storage_config

        def overused_alias_issue
          return unless config.alias
          return unless storage_config.users(config.alias).size > 1

          error(
            format(_("The device with alias '%s' is used by more than one device"), config.alias),
            kind: :overused_alias
          )
        end
      end
    end
  end
end
