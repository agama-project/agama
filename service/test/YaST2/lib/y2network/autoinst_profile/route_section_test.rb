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
require "y2network/autoinst_profile/route_section"
require "y2network/autoinst_profile/networking_section"
require "ipaddr"

describe Y2Network::AutoinstProfile::RouteSection do
  subject(:section) { described_class.new }

  describe ".new_from_network" do
    # Y2Network::Route is not vendored (see service/YaST2/README.md). #init_from_route only
    # relies on a handful of duck-typed methods, so a plain double stands in for it.
    let(:route) do
      double("Y2Network::Route",
        to: to, interface: interface, gateway: gateway, options: options,
        default?: (to == :default))
    end

    let(:route_ipv6) do
      double("Y2Network::Route",
        to: to_ipv6, interface: interface_ipv6, gateway: gateway_ipv6, options: nil,
        default?: false)
    end

    let(:to_ipv6) { IPAddr.new("2001:DB8:100::/32") }
    let(:interface_ipv6) { double("interface", name: "eth1") }
    let(:gateway_ipv6) { IPAddr.new("fe80::216:3eff:fe6d:c04") }

    let(:to) { IPAddr.new("192.168.122.0/24") }
    let(:interface) { double("interface", name: "eth0") }
    let(:gateway) { IPAddr.new("192.168.122.1") }
    let(:options) { "some-option" }

    let(:parent) { double("Installation::AutoinstProfile::SectionWithAttributes") }

    it "initializes the destination value" do
      section = described_class.new_from_network(route)
      expect(section.destination).to eq("192.168.122.0")
    end

    context "when it is the default route" do
      let(:to) { :default }

      it "initializes the destination to 'default'" do
        section = described_class.new_from_network(route)
        expect(section.destination).to eq("default")
      end
    end

    it "initializes the device value" do
      section = described_class.new_from_network(route)
      expect(section.device).to eq("eth0")
    end

    context "when the interface is missing" do
      let(:interface) { nil }

      it "initializes the device to '-'" do
        section = described_class.new_from_network(route)
        expect(section.device).to eq("-")
      end
    end

    it "initializes the gateway value" do
      section = described_class.new_from_network(route)
      expect(section.gateway).to eq("192.168.122.1")
      section_ipv6 = described_class.new_from_network(route_ipv6)
      expect(section_ipv6.gateway).to eq("fe80::216:3eff:fe6d:c04")
    end

    context "when the gateway is missing" do
      let(:gateway) { nil }

      it "initializes the gateway to '-'" do
        section = described_class.new_from_network(route)
        expect(section.gateway).to eq("-")
      end
    end

    it "initializes the netmask value" do
      section = described_class.new_from_network(route)
      expect(section.netmask).to eq("255.255.255.0")
      section_ipv6 = described_class.new_from_network(route_ipv6)
      expect(section_ipv6.netmask).to eq("ffff:ffff::")
    end

    context "when it is the default route" do
      let(:to) { :default }

      it "initializes the netmask to '-'" do
        section = described_class.new_from_network(route)
        expect(section.netmask).to eq("-")
      end
    end

    it "initializes the extrapara value" do
      section = described_class.new_from_network(route)
      expect(section.extrapara).to eq("some-option")
    end

    context "when options are missing" do
      let(:options) { nil }

      it "initializes the options to ''" do
        section = described_class.new_from_network(route)
        expect(section.extrapara).to eq("")
      end
    end

    it "sets the parent section" do
      section = described_class.new_from_network(route, parent)
      expect(section.parent).to eq(parent)
    end
  end

  describe ".new_from_hashes" do
    let(:hash) do
      {
        "destination" => "192.168.122.0",
        "netmask"     => "255.255.255.0",
        "device"      => "eth0",
        "gateway"     => "192.168.122.1",
        "extrapara"   => "foo"
      }
    end

    let(:default_gateway) do
      {
        "destination" => "default",
        "device"      => "eth1",
        "gateway"     => "192.168.1.1"
      }
    end

    it "initializes destination" do
      section = described_class.new_from_hashes(hash)
      expect(section.destination).to eq(hash["destination"])
    end

    it "initializes netmask" do
      section = described_class.new_from_hashes(hash)
      expect(section.netmask).to eq(hash["netmask"])
    end

    it "initializes device" do
      section = described_class.new_from_hashes(hash)
      expect(section.device).to eq(hash["device"])
    end

    it "initializes gateway" do
      section = described_class.new_from_hashes(hash)
      expect(section.gateway).to eq(hash["gateway"])
    end

    it "initializes extrapara" do
      section = described_class.new_from_hashes(hash)
      expect(section.extrapara).to eq(hash["extrapara"])
    end

    context "when destination is the default one" do
      it "sets destination as :default" do
        section = described_class.new_from_hashes(default_gateway)
        expect(section.destination).to eq(:default)
      end
    end
  end

  describe "#section_path" do
    let(:networking) do
      Y2Network::AutoinstProfile::NetworkingSection.new_from_hashes(
        "routing" => { "routes" => [{ "device" => "eth0" }] }
      )
    end

    subject(:section) { networking.routing.routes.first }

    it "returns the section path" do
      expect(section.section_path.to_s).to eq("networking,routing,routes,0")
    end
  end
end
