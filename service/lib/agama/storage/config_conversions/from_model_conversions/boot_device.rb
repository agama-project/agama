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

require "agama/storage/config_conversions/from_model_conversions/base"
require "agama/storage/configs/boot_device"

module Agama
  module Storage
    module ConfigConversions
      module FromModelConversions
        # Boot device conversion from model according to the JSON schema.
        class BootDevice < Base
          # @param model_json [Hash] Boot device model.
          # @param drives [Array<Configs::Drive>]
          def initialize(model_json, drives)
            super(model_json)
            @drives = drives
          end

        private

          # @return [Array<Configs::Drive>]
          attr_reader :drives

          # @see Base
          # @return [Configs::Boot]
          def default_config
            Configs::BootDevice.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              default:      model_json[:default],
              device_alias: convert_device_alias
            }
          end

          # @return [String, nil]
          def convert_device_alias
            # Avoid setting an alias if using the default boot device.
            return if model_json[:default]

            name = model_json[:name]
            return unless name

            drive = drives.find { |d| d.device_name == name }
            return unless drive

            drive.ensure_alias
          end
        end
      end
    end
  end
end
