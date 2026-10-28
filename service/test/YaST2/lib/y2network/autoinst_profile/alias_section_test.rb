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

require_relative "../../../../test_helper"
require "y2network/autoinst_profile/alias_section"
require "y2network/ip_address"

describe Y2Network::AutoinstProfile::AliasSection do
  subject(:section) { described_class.new }

  describe ".new_from_network" do
    # Y2Network::ConnectionConfig::IPConfig is not vendored (see service/YaST2/README.md), but
    # #init_from_config only relies on #address and #label, so a plain double standing in for it
    # is enough to exercise the real (vendored) Y2Network::IPAddress collaborator.
    let(:config) do
      double("Y2Network::ConnectionConfig::IPConfig",
        address: Y2Network::IPAddress.from_string("10.100.0.1/24"), label: "test")
    end

    it "initializes values properly" do
      section = described_class.new_from_network(config)
      expect(section.ipaddr).to eq("10.100.0.1")
      expect(section.prefixlen).to eq("24")
      expect(section.label).to eq("test")
    end
  end

  describe ".new_from_hashes" do
    let(:hash) do
      { "ipaddr" => "10.100.0.1", "prefixlen" => "24", "label" => "test" }
    end

    it "returns a section with the corresponding values" do
      section = described_class.new_from_hashes(hash)
      expect(section.ipaddr).to eq("10.100.0.1")
      expect(section.prefixlen).to eq("24")
      expect(section.label).to eq("test")
    end

    context "when keys use capital letters" do
      let(:hash) do
        { "IPADDR" => "10.100.0.1", "PREFIXLEN" => "24", "LABEL" => "test" }
      end

      it "returns a section with the corresponding values" do
        section = described_class.new_from_hashes(hash)
        expect(section.ipaddr).to eq("10.100.0.1")
        expect(section.prefixlen).to eq("24")
        expect(section.label).to eq("test")
      end
    end
  end
end
