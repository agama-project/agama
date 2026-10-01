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
require "y2network/autoinst_profile/routing_section"

describe Y2Network::AutoinstProfile::RoutingSection do
  subject(:section) { described_class.new }

  describe ".new_from_network" do
    # Y2Network::Routing is not vendored (see service/YaST2/README.md). #init_from_network only
    # relies on a handful of duck-typed methods, so a plain double is used instead of the
    # (unavailable) `instance_double`.
    let(:routing) do
      double("Y2Network::Routing", routes: [route1], forward_ipv4: true, forward_ipv6: true)
    end
    let(:route1) { double("Y2Network::Route") }
    let(:route_section) { double("Y2Network::AutoinstProfile::RouteSection") }
    let(:parent) { double("parent section") }

    before do
      allow(Y2Network::AutoinstProfile::RouteSection).to receive(:new_from_network)
        .with(route1, Y2Network::AutoinstProfile::RoutingSection)
        .and_return(route_section)
    end

    it "sets the ipv4_forward attribute" do
      section = described_class.new_from_network(routing)
      expect(section.ipv4_forward).to eq(true)
    end

    it "sets the ipv6_forward attribute" do
      section = described_class.new_from_network(routing)
      expect(section.ipv6_forward).to eq(true)
    end

    it "sets the routing section" do
      section = described_class.new_from_network(routing)
      expect(section.routes).to eq([route_section])
    end

    it "sets the parent section" do
      section = described_class.new_from_network(routing, parent)
      expect(section.parent).to eq(parent)
    end
  end

  describe ".new_from_hashes" do
    let(:hash) do
      {
        "ipv4_forward" => true,
        "ipv6_forward" => true,
        "routes"       => routes
      }
    end
    let(:route) { { "destination" => "default" } }
    let(:routes) { [route] }
    let(:route_section) { double("RouteSection") }

    before do
      allow(Y2Network::AutoinstProfile::RouteSection).to receive(:new_from_hashes)
        .with(route, Y2Network::AutoinstProfile::RoutingSection)
        .and_return(route_section)
    end

    it "initializes ipv4_forward" do
      section = described_class.new_from_hashes(hash)
      expect(section.ipv4_forward).to eq(true)
    end

    it "initializes ipv6_forward" do
      section = described_class.new_from_hashes(hash)
      expect(section.ipv4_forward).to eq(true)
    end

    it "includes one route section for each route" do
      section = described_class.new_from_hashes(hash)
      expect(section.routes).to eq([route_section])
    end

    context "when no routes are defined" do
      let(:routes) { nil }

      it "defaults to an empty array" do
        section = described_class.new_from_hashes(hash)
        expect(section.routes).to eq([])
      end
    end

    context "when ip_forward is enabled" do
      let(:hash) { { "ip_forward" => true } }

      it "enables ipv4_forward" do
        section = described_class.new_from_hashes(hash)
        expect(section.ipv4_forward).to eq(true)
      end

      it "enables ipv6_forward" do
        section = described_class.new_from_hashes(hash)
        expect(section.ipv6_forward).to eq(true)
      end
    end

    context "when ip_forward is disabled" do
      let(:hash) { { "ip_forward" => false } }

      it "disables ipv4_forward" do
        section = described_class.new_from_hashes(hash)
        expect(section.ipv4_forward).to eq(false)
      end

      it "disables ipv6_forward" do
        section = described_class.new_from_hashes(hash)
        expect(section.ipv6_forward).to eq(false)
      end
    end
  end
end
