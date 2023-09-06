# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "rspec"

module Agama
  module RSpec
    module Matchers
      module Storage
        ::RSpec::Matchers.define(:eq_outline) do |expected|
          match do |received|
            methods = [
              :required?, :filesystems, :base_min_size, :base_max_size, :adjust_by_ram?,
              :min_size_fallback_for, :max_size_fallback_for, :snapshots_configurable?,
              :snapshots_size, :snapshots_percentage
            ]

            methods.all? { |m| received.public_send(m) == expected.public_send(m) }
          end

          failure_message do |received|
            "Volume outline does not match.\n" \
              "Expected: #{expected.inspect}\n" \
              "Received: #{received.inspect}"
          end
        end
      end
    end
  end
end
