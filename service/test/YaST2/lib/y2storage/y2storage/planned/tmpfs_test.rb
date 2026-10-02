#!/usr/bin/env rspec
# frozen_string_literal: true

#
# Copyright (c) [2020] SUSE LLC
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
require "y2storage/planned"

describe Y2Storage::Planned::Tmpfs do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject(:tmpfs) { described_class.new(mount_point, "size=3G") }

  # Only basic cases are tested here. More exhaustive tests can be found in tests
  # for Y2Storage::MatchVolumeSpec
  describe "#match_value?" do
    let(:volume) do
      Y2Storage::VolumeSpecification.new({}).tap do |vol|
        vol.mount_point = "/boot"
        vol.fs_types = [Y2Storage::Filesystems::Type::TMPFS]
      end
    end

    let(:excludes) { [:size, :partition_id] }

    before do
      tmpfs.mount_point = mount_point
    end

    context "when the planned partition has the same values" do
      let(:mount_point) { volume.mount_point }

      it "returns true" do
        expect(tmpfs.match_volume?(volume, exclude: excludes)).to eq(true)
      end
    end

    context "when the planned tmpfs does not have same values" do
      let(:mount_point) { "/srv" }

      it "returns false" do
        expect(tmpfs.match_volume?(volume, exclude: excludes)).to eq(false)
      end
    end
  end
end
