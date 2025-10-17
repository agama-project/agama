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

require "agama/storage/devicegraph_conversions/to_json_conversions/device"

module Agama
  module Storage
    module DevicegraphConversions
      module ToJSONConversions
        # Devicegraph conversion to JSON array according to schema.
        #
        # This class has the same API and functionality than
        # Agama::Storage::DevicegraphConversions::ToJSON. So it's kind of a surplus extra
        # level of indirection. It only exists to mimic the organization of other conversions.
        class Devicegraph
          # @param devicegraph [Y2Storage::Devicegraph]
          def initialize(devicegraph)
            @devicegraph = devicegraph
          end

          def convert
            original_devices.map {|d| ToJSONConversions::Device.new(d).convert }
          end

        private

          # @return [Y2Storage::Devicegraph]
          attr_reader :devicegraph

          def original_devices
            devicegraph.disk_devices +
              devicegraph.stray_blk_devices +
              devicegraph.software_raids +
              devicegraph.lvm_vgs
          end
        end
      end
    end
  end
end
