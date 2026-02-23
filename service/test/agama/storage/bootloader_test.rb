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

require "agama/storage/bootloader"

describe Agama::Storage::Bootloader::Config do
  subject(:config) { described_class.new }

  describe "#to_json" do
    before do
      config.load_json({ "stopOnBootMenu" => true }.to_json)
    end

    it "serializes its content with keys as camelCase" do
      expect(config.to_json).to eq "{\"stopOnBootMenu\":true}"
    end

    it "can serialize in a way that #load_json can restore it" do
      config.stop_on_boot_menu = false
      json = config.to_json
      config.stop_on_boot_menu = true
      config.load_json(json)
      expect(config.stop_on_boot_menu).to eq false
    end

    it "exports only what was previously set" do
      expect(config.to_json).to eq "{\"stopOnBootMenu\":true}"
      config.load_json({ "timeout" => 10, "extraKernelParams" => "verbose" }.to_json)
      expect(config.to_json).to eq "{\"timeout\":10,\"extraKernelParams\":\"verbose\"}"
    end
  end

  describe "#load_json" do
    it "loads config from given json" do
      content = "{\"stopOnBootMenu\":true,\"updateNvram\":true}"
      config.load_json(content)
      expect(config.stop_on_boot_menu).to eq true
      expect(config.update_nvram).to eq true
    end

    it "remembers which keys are set" do
      content = "{\"timeout\":10}"
      config.load_json(content)
      expect(config.keys_to_export).to eq([:timeout])
    end
  end
end
