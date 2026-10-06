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
require "y2network/wireless_auth_mode"

describe Y2Network::WirelessAuthMode do
  subject(:auth_mode) { described_class.new("custom", "custom") }

  describe ".all" do
    it "returns all known auth modes" do
      expect(described_class.all).to_not be_empty
      expect(described_class.all.first).to be_a(described_class)
    end
  end

  describe ".from_short_name" do
    it "returns auth mode with the given name" do
      expect(described_class.from_short_name("none"))
        .to eq(Y2Network::WirelessAuthMode::NONE)
    end

    it "returns nil if the given name is not found" do
      expect(described_class.from_short_name("dummy")).to eq nil
    end
  end

  describe "#to_sym" do
    it "returns the symbol representation" do
      expect(subject.to_sym).to eq(:custom)
    end
  end
end
