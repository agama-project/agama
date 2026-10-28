#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::Planned::HasSize do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  # Dummy class to test the mixin
  class DeviceWithSize
    include Y2Storage::Planned::HasSize

    def initialize(min, weight)
      initialize_has_size
      self.min = min
      self.weight = weight
    end
  end

  describe ".distribute_space" do
    let(:dev1) { DeviceWithSize.new(1.GiB, 1) }
    let(:dev2) { DeviceWithSize.new(1.GiB, 1) }

    # Regression test. There was a bug and it tried to assign 501 extra bytes
    # to each volume (one more byte than available)
    it "does not distribute more space than available" do
      space = 2.GiB + Y2Storage::DiskSize.new(1001)
      result = DeviceWithSize.distribute_space([dev1, dev2], space)
      expect(result).to contain_exactly(
        an_object_having_attributes(size: 1.GiB + Y2Storage::DiskSize.new(501)),
        an_object_having_attributes(size: 1.GiB + Y2Storage::DiskSize.new(500))
      )
    end
  end
end
