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
require "agama/storage/config_conversions/from_json_conversions/boot"
require "agama/storage/config_conversions/from_json_conversions/drive"
require "agama/storage/config"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Config conversion from JSON hash according to schema.
        class Config < Base
          # @param config_json [Hash]
          # @param config_builder [ConfigBuilder, nil]
          def initialize(config_json, config_builder: nil)
            super(config_builder)
            @config_json = config_json
          end

          # @see Base#convert
          #
          # @param default [Config, nil]
          # @return [Config]
          def convert(default = nil)
            super(default || Storage::Config.new)
          end

        private

          # @return [Hash]
          attr_reader :config_json

          # @see Base#conversions
          #
          # @param default [Config]
          # @return [Hash]
          def conversions(default)
            {
              boot:   convert_boot(default.boot),
              drives: convert_drives
            }
          end

          # @param default [Configs::Boot, nil]
          # @return [Configs::Boot, nil]
          def convert_boot(default = nil)
            boot_json = config_json[:boot]
            return unless boot_json

            FromJSONConversions::Boot.new(boot_json).convert(default)
          end

          # @return [Array<Configs::Drive>, nil]
          def convert_drives
            drives_json = config_json[:drives]
            return unless drives_json

            drives_json.map { |d| convert_drive(d) }
          end

          # @param drive_json [Hash]
          # @return [Configs::Drive]
          def convert_drive(drive_json)
            FromJSONConversions::Drive.new(drive_json, config_builder: config_builder).convert
          end
        end
      end
    end
  end
end
