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

require_relative "../../test_helper"
require "agama/config"
require "agama/storage/volume"

describe Agama::Storage::Volume do
  describe ".new_from_json" do
    let(:config) { Agama::Config.new }

    let(:volume_json) do
      {
        mount: {
          path: "/test"
        }
      }
    end

    it "generates a volume from JSON according to schema" do
      result = described_class.new_from_json(volume_json, config: config)
      expect(result).to be_a(Agama::Storage::Volume)
      expect(result.mount_path).to eq("/test")
    end
  end

  describe "#to_json_settngs" do
    let(:volume) { Agama::Storage::Volume.new("/test") }

    it "generates a JSON hash according to schema" do
      result = volume.to_json_settings
      expect(result).to be_a(Hash)
    end
  end
end
