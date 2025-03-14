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

require "agama/storage/config_conversions/from_json_conversions/base"
require "agama/storage/configs/boot"
require "agama/storage/configs/boot_device"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Boot conversion from JSON hash according to schema.
        class Boot < Base
        private

          alias_method :boot_json, :config_json

          # @see Base
          # @return [Configs::Boot]
          def default_config
            Configs::Boot.new
          end

          # @see Base#conversions
          # @return [Hash]
          def conversions
            {
              configure: boot_json[:configure],
              device:    convert_device
            }
          end

          # @return [Configs::BootDevice, nil]
          def convert_device
            boot_device_json = boot_json[:device]
            return unless boot_device_json

            Configs::BootDevice.new.tap do |config|
              config.default = false
              config.device_alias = boot_json[:device]
            end
          end
        end
      end
    end
  end
end
