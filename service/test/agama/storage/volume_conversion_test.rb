# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require_relative "../../test_helper"
require "agama/config"
require "agama/storage/proposal_settings"
require "agama/storage/volume"
require "agama/storage/volume_conversion"
require "y2storage"

describe Agama::Storage::VolumeConversion do
  describe "#from_y2storage" do
    let(:volume) { Agama::Storage::Volume.new("/test") }

    it "generates a volume" do
      result = described_class.from_y2storage(volume)
      expect(result).to be_a(Agama::Storage::Volume)
    end
  end

  describe "#to_y2storage" do
    let(:volume) { Agama::Storage::Volume.new("/test") }

    it "generates a Y2Storage volume spec" do
      result = described_class.to_y2storage(volume)
      expect(result).to be_a(Y2Storage::VolumeSpecification)
    end
  end
end
