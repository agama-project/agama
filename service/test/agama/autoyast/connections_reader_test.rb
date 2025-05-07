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
require "yast"
require "agama/autoyast/connections_reader"
require "y2network/autoinst_profile/interfaces_section"

describe Agama::AutoYaST::ConnectionsReader do
  let(:interfaces) { [eth0] }
  let(:eth0) do
    { "bootproto" => eth0_bootproto, "name" => "eth0" }
  end
  let(:ipv6?) { true }
  let(:dns) { { "nameservers" => ["1.1.1.1"], "dns_searchlist" => ["example.lan"] } }
  let(:eth0_bootproto) { "dhcp" }

  subject do
    section = Y2Network::AutoinstProfile::InterfacesSection.new_from_hashes(
      interfaces
    )
    described_class.new(section, ipv6: ipv6?, dns: dns)
  end

  describe "#read" do
    context "when there are no interfaces" do
      let(:interfaces) { [] }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when bootproto is set to DHCP" do
      it "sets method4 to 'auto'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("auto")
      end

      it "sets method6 to 'auto'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("auto")
      end

      context "when IPv6 is disabled" do
        let(:ipv6?) { false }

        it "sets method6 to 'disabled'" do
          connections = subject.read["connections"]
          conn = connections.find { |c| c["id"] == "eth0" }
          expect(conn["method6"]).to eq("disabled")
        end
      end
    end

    context "when bootproto is set to DHCP6" do
      let(:eth0_bootproto) { "dhcp6" }

      it "sets method6 to 'auto'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("auto")
      end

      it "sets method4 to 'disabled'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("disabled")
      end
    end

    context "when bootproto is set to STATIC" do
      let(:eth0_bootproto) { "static" }

      it "sets method4 to 'manual'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("manual")
      end

      it "sets method6 to 'manual'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("manual")
      end

      context "when IPv6 is disabled" do
        let(:ipv6?) { false }

        it "sets method6 to 'disabled'" do
          connections = subject.read["connections"]
          conn = connections.find { |c| c["id"] == "eth0" }
          expect(conn["method6"]).to eq("disabled")
        end
      end
    end

    context "when bootproto is set to NONE" do
      let(:eth0_bootproto) { "none" }

      it "sets method4 to 'disabled'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("disabled")
      end

      it "sets method6 to 'disabled'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("disabled")
      end
    end

    context "when an IP and a prefix are given" do
      let(:eth0) do
        { name: "eth0", ipaddr: "192.168.122.2", prefixlen: "24" }
      end

      it "includes the IP to the list of addresses" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["addresses"].map(&:to_s)).to eq(["192.168.122.2/24"])
      end
    end

    context "when an IP and a netmask are given" do
      let(:eth0) do
        { name: "eth0", ipaddr: "192.168.122.2", netmask: "255.255.255.0" }
      end

      it "includes the IP to the list of addresses" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["addresses"].map(&:to_s)).to eq(["192.168.122.2/24"])
      end
    end

    context "when IP aliases are defined" do
      let(:eth0) do
        {
          name: "eth0", ipaddr: "192.168.122.2", prefixlen: "24",
          "aliases" => {
            alias0: { ipaddr: "10.0.0.2", prefixlen: "255.0.0.0", label: "0" },
            alias1: { ipaddr: "192.168.0.2", prefixlen: "24", label: "1" }
          }
        }
      end

      it "includes them in the list of IP addresses" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["addresses"].map(&:to_s))
          .to eq(["192.168.122.2/24", "10.0.0.2/8", "192.168.0.2/24"])
      end
    end

    context "when there are wireless settings" do
      let(:eth0) do
        { "name" => "eth0", "wireless_mode" => "wpa-psk" }
      end

      it "includes a 'wireless' key containing those settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["wireless"]).to be_a(Hash)
      end
    end

    context "when there are bonding settings" do
      let(:eth0) do
        { "name" => "eth0", "bonding_slave0" => "eth1" }
      end

      it "includes a 'bond' key containing those settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["bond"]).to be_a(Hash)
      end
    end

    it "adds DNS settings to the connection" do
      connections = subject.read["connections"]
      connections.each do |conn|
        expect(conn).to include(dns)
      end
    end
  end
end
