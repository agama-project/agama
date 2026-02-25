# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "agama/storage/devicegraph_conversions/to_json_conversions/section"

module Agama
  module Storage
    module DevicegraphConversions
      module ToJSONConversions
        # Section with properties for multipath devices.
        class Multipath < Section
          # @see Section.apply?
          def self.apply?(storage_device)
            storage_device.is?(:multipath)
          end

        private

          # @see Section#conversions
          def conversions
            { wireNames: multipath_wire_names }
          end

          # Name of the multipath wires.
          #
          # @note: The multipath wires are not exported yet.
          #
          # @return [Array<String>]
          def multipath_wire_names
            storage_device.parents.map(&:name)
          end
        end
      end
    end
  end
end
