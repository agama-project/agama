# frozen_string_literal: true

# Copyright (c) [2024-2026] SUSE LLC
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

require "agama/storage/config_conversions/to_model_conversions/base"
require "agama/storage/config_conversions/to_model_conversions/boot_device"

module Agama
  module Storage
    module ConfigConversions
      module ToModelConversions
        # Boot config conversion to model according to the JSON schema.
        class Boot < Base
          # @param config [Storage::Config]
          # @param bootloader_config [Storage::BootloaderConfig]
          def initialize(config, bootloader_config)
            super()
            @config = config
            @bootloader_config = bootloader_config
          end

        private

          # @return [Storage::BootloaderConfig, nil]
          attr_reader :bootloader_config

          # @see Base#conversions
          def conversions
            {
              configure:  config.boot.configure?,
              device:     convert_device,
              bootloader: convert_bootloader
            }
          end

          # @return [Hash]
          def convert_device
            return unless config.boot.configure?

            ToModelConversions::BootDevice.new(config).convert
          end

          # @return [String, nil]
          def convert_bootloader
            bootloader_type = bootloader_config&.type
            return nil if bootloader_type.nil? || bootloader_type.is?(:none)

            bootloader_type.value
          end
        end
      end
    end
  end
end
