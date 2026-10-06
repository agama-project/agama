#!/usr/bin/env rspec
#
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

describe Y2Storage::Proposal::DeviceShrinkage do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:shrinkage) { described_class.new(planned, real) }

  let(:planned) { planned_partition(min_size: 2.5.GiB) }
  let(:real) { instance_double(Y2Storage::Partition, size: 2.GiB) }

  describe "#diff" do
    it "returns the difference between planned and real sizes" do
      expect(shrinkage.diff).to eq(0.5.GiB)
    end
  end
end
