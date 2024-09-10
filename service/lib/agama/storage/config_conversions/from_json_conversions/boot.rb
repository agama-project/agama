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

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Boot conversion from JSON hash according to schema.
        class Boot < Base
          # @param boot_json [Hash]
          def initialize(boot_json)
            super()
            @boot_json = boot_json
          end

          # @see Base#convert
          #
          # @param default [Configs::Boot, nil]
          # @return [Configs::Boot]
          def convert(default = nil)
            super(default || Configs::Boot.new)
          end

        private

          # @return [Hash]
          attr_reader :boot_json

          # @see Base#conversions
          #
          # @param _default [Configs::Boot]
          # @return [Hash]
          def conversions(_default)
            {
              configure: boot_json[:configure],
              device:    boot_json[:device]
            }
          end
        end
      end
    end
  end
end
