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

require "agama/storage/config_conversions/from_json_conversions/size"

module Agama
  module Storage
    module ConfigConversions
      module FromJSONConversions
        # Mixin for size conversion.
        module WithSize
          # @param json [Hash]
          # @param default [Configs::Size, nil]
          #
          # @return [Configs::Size, nil]
          def convert_size(json, default: nil)
            size_json = json[:size]
            return unless size_json

            FromJSONConversions::Size.new(size_json).convert(default)
          end
        end
      end
    end
  end
end
