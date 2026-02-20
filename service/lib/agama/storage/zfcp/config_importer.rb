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
require "agama/storage/zfcp/config"
require "agama/storage/zfcp/config_importers/device"

module Agama
  module Storage
    module ZFCP
      # Class for generating a zFCP config object from a JSON.
      class ConfigImporter < JSONImporter
        # @return [Config]
        def target
          Config.new
        end

        # @see Agama::JSONImporter#imports
        def imports
          {
            controllers: import_controllers,
            devices:     import_devices
          }
        end

        # @return [Array<String>, nil]
        def import_controllers
          controllers_json = json[:controllers]
          return unless controllers_json

          controllers_json.map { |c| c[:wwpn] }
        end

        # @return [Array<Configs::Device>, nil]
        def import_devices
          devices_json = json[:devices]
          return unless devices_json

          devices_json.map { |d| ConfigImporters::Device.new(d).import }
        end
      end
    end
  end
end
