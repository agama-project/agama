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
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the boot config.
      class Boot < Base
        include Yast::I18n

        # Boot config issues.
        #
        # @return [Array<Issue>]
        def issues
          [
            missing_alias_issue,
            invalid_alias_issue
          ].compact
        end

      private

        # @return [Boolean]
        def configure?
          storage_config.boot.configure?
        end

        # @return [String, nil]
        def device_alias
          storage_config.boot.device.device_alias
        end

        # @return [Issue, nil]
        def missing_alias_issue
          return unless configure? && device_alias.nil?

          # Currently this situation only happens because the config solver was not able to find
          # a device config containing a root volume. The message could become inaccurate if the
          # solver logic changes.
          error(
            _("The boot device cannot be automatically selected because there is no root (/) " \
              "file system")
          )
        end

        # @return [Issue, nil]
        def invalid_alias_issue
          return unless configure? && device_alias && !valid_alias?

          # TRANSLATORS: %s is replaced by a device alias (e.g., "boot").
          error(format(_("There is no boot device with alias '%s'"), device_alias))
        end

        # @return [Boolean]
        def valid_alias?
          return false unless device_alias

          storage_config.drives.any? { |d| d.alias?(device_alias) }
        end
      end
    end
  end
end
