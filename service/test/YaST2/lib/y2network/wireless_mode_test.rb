# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../../test_helper"
require "y2network/wireless_mode"

describe Y2Network::WirelessMode do
  subject(:mode) { described_class.new("Custom", "custom") }

  describe ".all" do
    it "returns all the predefined wireless modes" do
      expect(described_class.all).to contain_exactly(
        Y2Network::WirelessMode::AD_HOC,
        Y2Network::WirelessMode::MANAGED,
        Y2Network::WirelessMode::MASTER
      )
    end
  end

  describe "#name" do
    it "returns the (untranslated) name given to the constructor" do
      expect(mode.name).to eq("Custom")
    end
  end

  describe "#short_name" do
    it "returns the short name given to the constructor" do
      expect(mode.short_name).to eq("custom")
    end
  end

  describe "#to_human_string" do
    it "returns the translated name" do
      expect(mode.to_human_string).to eq("Custom")
    end
  end

  describe "the predefined modes" do
    it "exposes 'ad-hoc' as AD_HOC" do
      expect(Y2Network::WirelessMode::AD_HOC.short_name).to eq("ad-hoc")
    end

    it "exposes 'managed' as MANAGED" do
      expect(Y2Network::WirelessMode::MANAGED.short_name).to eq("managed")
    end

    it "exposes 'master' as MASTER" do
      expect(Y2Network::WirelessMode::MASTER.short_name).to eq("master")
    end
  end
end
