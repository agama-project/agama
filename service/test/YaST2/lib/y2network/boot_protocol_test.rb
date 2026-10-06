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
require "y2network/boot_protocol"

describe Y2Network::BootProtocol do
  subject(:protocol) { described_class.new("dhcp") }

  describe ".all" do
    it "returns all known boot protocols" do
      expect(described_class.all).to_not be_empty
      expect(described_class.all.first).to be_a(described_class)
    end
  end

  describe ".from_name" do
    it "returns boot protocol with given name" do
      expect(described_class.from_name("dhcp4")).to eq Y2Network::BootProtocol::DHCP4
    end

    it "returns nil if given name not found" do
      expect(described_class.from_name("dhcp8")).to eq nil
    end
  end

  describe "#dhcp?" do
    it "returns true if protocol at least partially is read from dhcp" do
      expect(Y2Network::BootProtocol::DHCP4.dhcp?).to eq true
      expect(Y2Network::BootProtocol::DHCP_AUTOIP.dhcp?).to eq true
      expect(Y2Network::BootProtocol::STATIC.dhcp?).to eq false
    end
  end

  describe "#static?" do
    it "returns true for STATIC boot protocol" do
      expect(Y2Network::BootProtocol::STATIC.static?).to eq(true)
    end

    it "returns false for non static boot protocols" do
      non_static = Y2Network::BootProtocol.all - [Y2Network::BootProtocol::STATIC]
      non_static.each { |b| expect(b.static?).to eq(false) }
    end
  end

  describe "#==" do
    context "when the other object refers to the same boot protocol" do
      it "returns true" do
        expect(protocol).to eq(described_class.new("dhcp"))
      end
    end

    context "when the other object refers to a different boot protocol" do
      it "returns false" do
        expect(protocol).to_not eq(described_class.new("static"))
      end
    end
  end
end
