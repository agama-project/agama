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

require "agama/json_importer"
require "agama/storage/dasd/configs/device"

module Agama
  module Storage
    module DASD
      module ConfigImporters
        # Class for generating a DASD device config from a JSON.
        class Device < JSONImporter
          # @return [Configs::Device]
          def target
            Configs::Device.new
          end

          # @see Agama::JSONImporter#imports
          def imports
            {
              channel:       json[:channel],
              active:        import_active,
              format_action: import_format_action,
              diag_action:   import_diag_action
            }
          end

          # @return [Boolean]
          def import_active
            return unless json[:state]

            json[:state] == "active"
          end

          # @return [:format, :format_if_needed, :not_format]
          def import_format_action
            return Configs::Device::FormatAction::FORMAT_IF_NEEDED if json[:format].nil?

            return Configs::Device::FormatAction::FORMAT if json[:format]

            Configs::Device::FormatAction::NONE
          end

          # @return [:enable, :disable, :keep]
          def import_diag_action
            return Configs::Device::DiagAction::NONE if json[:diag].nil?

            json[:diag] ? Configs::Device::DiagAction::ENABLE : Configs::Device::DiagAction::DISABLE
          end
        end
      end
    end
  end
end
