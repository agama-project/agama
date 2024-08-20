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
      # Search configuration.
      class Search
        attr_reader :device
        attr_accessor :if_not_found

        def initialize
          @if_not_found = :skip
        end

        def resolved?
          !!@resolved
        end

        def skip_device?
          resolved? && device.nil? && if_not_found == :skip
        end

        def find(_setting, candidate_devs, used_sids)
          devices = candidate_devs.reject { |d| used_sids.include?(d.sid) }
          @resolved = true
          @device = devices.min_by(&:name)
        end
      end
    end
  end
end
