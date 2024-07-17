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

module Agama
  module Storage
    module Configs
      class Search
        attr_reader :device

        def find(setting, devicegraph, used_sids, parent: nil)
          devices = candidate_devices(setting, devicegraph, parent)
          devices.reject! { |d| used_sids.include?(d.sid) }
          @device = devices.sort_by(&:name).first
        end

        def candidate_devices(setting, devicegraph, parent)
          if setting.kind_of?(Drive)
            devicegraph.blk_devices.select do |dev|
              dev.is?(:disk_device, :stray_blk_device)
            end
          else
            devicegraph.find_device(parent).partitions
          end
        end
      end
    end
  end
end
