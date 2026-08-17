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
  let(:dns) { { "nameservers" => ["1.1.1.1"], "dnsSearchList" => ["example.lan"] } }
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

    context "when the connection has a \"device\"" do
      let(:interfaces) do
        [{ "device" => "eth1" }]
      end

      it "uses the \"device\" as \"id\" and \"interface\"" do
        connections = subject.read["connections"]
        conn = connections.first
        expect(conn["id"]).to eq("eth1")
        expect(conn["interface"]).to eq("eth1")
      end
    end

    context "when the connection has a \"name\"" do
      let(:interfaces) do
        [{ "name" => "eth0" }]
      end

      it "uses the \"name\" as \"id\"" do
        connections = subject.read["connections"]
        conn = connections.first
        expect(conn["id"]).to eq("eth0")
        expect(conn["interface"]).to be_nil
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

    context "when bootproto is set to AUTOIP" do
      let(:eth0_bootproto) { "autoip" }

      it "sets method4 to 'link-local'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("link-local")
      end

      it "sets method6 to 'disabled'" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("disabled")
      end
    end

    context "when no startmode is given" do
      it "does not set the 'autoconnect' and 'status' settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn.keys).to_not include("autoconnect", "status")
      end
    end

    context "when startmode is set to a mode that starts the connection" do
      # "boot", "on" and "onboot" are aliases of "auto"
      ["auto", "boot", "on", "onboot", "hotplug", "ifplugd", "nfsroot"].each do |mode|
        context "like #{mode.inspect}" do
          let(:eth0) do
            { "name" => "eth0", "startmode" => mode }
          end

          it "enables 'autoconnect' and does not force the connection status" do
            connections = subject.read["connections"]
            conn = connections.find { |c| c["id"] == "eth0" }
            expect(conn["autoconnect"]).to eq(true)
            expect(conn.keys).to_not include("status")
          end
        end
      end
    end

    context "when startmode is set to a mode that does not start the connection" do
      ["manual", "off"].each do |mode|
        context "like #{mode.inspect}" do
          let(:eth0) do
            { "name" => "eth0", "startmode" => mode }
          end

          it "disables 'autoconnect' and keeps the connection down" do
            connections = subject.read["connections"]
            conn = connections.find { |c| c["id"] == "eth0" }
            expect(conn["autoconnect"]).to eq(false)
            expect(conn["status"]).to eq("down")
          end
        end
      end
    end

    context "when startmode is set to an unknown value" do
      let(:eth0) do
        { "name" => "eth0", "startmode" => "whatever" }
      end

      it "does not set the 'autoconnect' and 'status' settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn.keys).to_not include("autoconnect", "status")
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
        { "name" => "eth0", "wireless_essid" => "mywifi" }
      end

      it "includes a 'wireless' key containing those settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn["wireless"]).to be_a(Hash)
      end
    end

    context "when there are bonding settings" do
      let(:eth0) do
        {
          "name"                => "bond0",
          "bonding_slave0"      => "eth1",
          "bonding_module_opts" => "mode=active-backup miimon=100"
        }
      end

      it "includes a 'bond' key containing those settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "bond0" }
        expect(conn["bond"]).to eq(
          "ports" => ["eth1"], "mode" => "active-backup", "options" => "miimon=100"
        )
      end

      it "does not nest the 'bond' section into itself" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "bond0" }
        expect(conn["bond"]).to_not have_key("bond")
      end
    end

    context "when there are bridge settings" do
      let(:eth0) do
        { "name" => "br0", "bridge" => "yes", "bridge_ports" => "eth1 eth2" }
      end

      it "includes a 'bridge' key containing those settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "br0" }
        expect(conn["bridge"]).to eq("ports" => ["eth1", "eth2"])
      end
    end

    context "when there are VLAN settings" do
      let(:eth0) do
        { "name" => "eth1.10", "vlan_id" => "10", "etherdevice" => "eth1" }
      end

      it "includes a 'vlan' key containing those settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth1.10" }
        expect(conn["vlan"]).to eq("id" => 10, "parent" => "eth1")
      end
    end

    context "when it is a plain Ethernet connection" do
      it "does not include any device type specific settings" do
        connections = subject.read["connections"]
        conn = connections.find { |c| c["id"] == "eth0" }
        expect(conn.keys).to_not include("bond", "bridge", "vlan", "wireless")
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
