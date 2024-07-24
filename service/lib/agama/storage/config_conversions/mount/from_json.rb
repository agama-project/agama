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

require "agama/storage/configs/mount"

module Agama
  module Storage
    module ConfigConversions
      module Mount
        # Mount conversion from JSON hash according to schema.
        class FromJSON
          # @param mount_json [Hash]
          def initialize(mount_json)
            @mount_json = mount_json
          end

          # Performs the conversion from Hash according to the JSON schema.
          #
          # @return [Configs::Mount]
          def convert
            Configs::Mount.new.tap do |config|
              config.path = mount_json[:path]
              config.options = mount_json[:options] || []
            end
          end

        private

          # @return [Hash]
          attr_reader :mount_json
        end
      end
    end
  end
end
