# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "agama/storage/bootloader_config_solver"
require "agama/storage/config_checkers/base"
require "bootloader/systeminfo"
require "yast/i18n"

module Agama
  module Storage
    module ConfigCheckers
      # Class for checking the bootloader config.
      class Bootloader < Base
        include Yast::I18n

        # @param bootloader_config [Storage::BootloaderConfig]
        def initialize(bootloader_config)
          super()

          textdomain "agama"
          @bootloader_config = bootloader_config
        end

        # Bootloader config issues.
        #
        # @return [Array<Issue>]
        def issues
          [
            unsupported_bootloader_issue
          ].compact
        end

      private

        # @return [Storage::BootloaderConfig]
        attr_reader :bootloader_config

        # Issue if a BLS bootloader is selected on a non-EFI or unsupported system.
        #
        # @return [Issue, nil]
        def unsupported_bootloader_issue
          return unless bootloader_config.type&.bls?

          if !::Bootloader::Systeminfo.efi?
            error(
              format(
                _("The bootloader '%s' cannot be installed on a non-EFI system."),
                bootloader_config.type.to_s
              ),
              kind: IssueClasses::Config::WRONG_BOOTLOADER
            )
          elsif !BootloaderConfigSolver.bls_compliant_system?
            error(
              format(
                _("The bootloader '%s' is not supported on this architecture."),
                bootloader_config.type.to_s
              ),
              kind: IssueClasses::Config::WRONG_BOOTLOADER
            )
          end
        end
      end
    end
  end
end
