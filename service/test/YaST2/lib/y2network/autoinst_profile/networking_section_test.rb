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
require "y2network/autoinst_profile/networking_section"

describe Y2Network::AutoinstProfile::NetworkingSection do
  describe ".new_from_network" do
    # Y2Network::Config and Y2Network::Backend are not vendored (see service/YaST2/README.md).
    # A plain double stands in for the config, exposing empty `connections`/`interfaces`
    # collections (matching upstream, which also uses `interfaces: []`) so that
    # InterfacesSection/UdevRulesSection/S390DevicesSection.new_from_network - which are never
    # stubbed here - only ever map over empty arrays.
    let(:config) do
      double("Y2Network::Config",
        routing:     routing,
        dns:         dns,
        hostname:    hostname,
        connections: [],
        interfaces:  [],
        backend:     backend,
        backend?:    false)
    end
    let(:routing) { double("Y2Network::Routing") }
    let(:routing_section) { double("RoutingSection") }
    let(:dns) { double("Y2Network::DNS") }
    let(:hostname) { double("Y2Network::Hostname") }
    let(:dns_section) { double("DNSSection") }
    let(:backend) { double("Y2Network::Backend", id: :none) }

    before do
      allow(Y2Network::AutoinstProfile::RoutingSection).to receive(:new_from_network)
        .with(routing).and_return(routing_section)
      allow(Y2Network::AutoinstProfile::DNSSection).to receive(:new_from_network)
        .with(dns, hostname).and_return(dns_section)
    end

    it "initializes the routing section" do
      section = described_class.new_from_network(config)
      expect(section.routing).to eq(routing_section)
    end

    it "initializes the backend according to the one in use" do
      section = described_class.new_from_network(config)
      expect(section.backend).to eq("none")
    end
  end

  describe ".new_from_hashes" do
    let(:hash) do
      {
        "routing"  => routing,
        "dns"      => dns,
        "net-udev" => net_udev
      }
    end
    let(:routing) { {} }
    let(:routing_section) { double("RoutingSection") }
    let(:dns) { {} }
    let(:dns_section) { double("DNSSection") }
    let(:net_udev) { {} }

    it "initializes the routing section" do
      section = described_class.new_from_hashes(hash)
      expect(section.routing).to be_a(Y2Network::AutoinstProfile::RoutingSection)
    end

    context "when no routing section is present" do
      let(:routing) { nil }

      it "does not initialize the routing section" do
        section = described_class.new_from_hashes(hash)
        expect(section.routing).to eq(nil)
      end
    end

    it "initializes the dns section" do
      section = described_class.new_from_hashes(hash)
      expect(section.dns).to be_a(Y2Network::AutoinstProfile::DNSSection)
    end

    context "when no dns section is present" do
      let(:dns) { nil }

      it "does not initialize the dns section" do
        section = described_class.new_from_hashes(hash)
        expect(section.dns).to eq(nil)
      end
    end

    it "initializes the udev rules section" do
      section = described_class.new_from_hashes(hash)
      expect(section.udev_rules.udev_rules).to eq([])
    end
  end
end
