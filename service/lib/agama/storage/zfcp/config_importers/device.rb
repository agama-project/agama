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
require "agama/storage/zfcp/configs/device"

module Agama
  module Storage
    module ZFCP
      module ConfigImporters
        # Class for generating a zFCP device config from a JSON.
        class Device < JSONImporter
          # @return [Configs::Device]
          def target
            Configs::Device.new
          end

          # @see Agama::JSONImporter#imports
          def imports
            {
              channel: json[:channel],
              wwpn:    json[:wwpn],
              lun:     json[:lun],
              active:  import_active
            }
          end

          # @return [Boolean]
          def import_active
            return true unless json[:active]

            json[:active]
          end
        end
      end
    end
  end
end
