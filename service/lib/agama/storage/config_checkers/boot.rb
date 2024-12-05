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
          [missing_boot_device_issue].compact
        end

      private

        # @return [Configs::Boot]
        def boot
          storage_config.boot
        end

        # @return [Issue, nil]
        def missing_boot_device_issue
          return unless boot.configure? && boot.device
          return if storage_config.drives.any? { |d| d.alias == boot.device }

          # TRANSLATORS: %s is the replaced by a device alias (e.g., "boot").
          error(format(_("There is no boot device with alias '%s'"), boot.device))
        end
      end
    end
  end
end
