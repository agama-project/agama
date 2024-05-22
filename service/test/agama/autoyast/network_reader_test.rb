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
require "agama/autoyast/network_reader"

Yast.import "Profile"

describe Agama::AutoYaST::NetworkReader do
  let(:profile) do
    {
      "networking" => {
        "interfaces" => [eth0],
        "ipv6"       => ipv6
      }
    }
  end

  let(:eth0) do
    { "bootproto" => eth0_bootproto, "name" => "eth0" }
  end
  let(:ipv6) { true }
  let(:eth0_bootproto) { "dhcp" }

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'networking' section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when bootproto is set to DHCP" do
      it "sets method4 to 'auto'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("auto")
      end

      it "sets method6 to 'auto'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("auto")
      end

      context "when IPv6 is disabled" do
        let(:ipv6) { false }

        it "sets method6 to 'disabled'" do
          network = subject.read["network"]
          conn = network["connections"].find { |c| c["id"] == "eth0" }
          expect(conn["method6"]).to eq("disabled")
        end
      end
    end

    context "when bootproto is set to DHCP6" do
      let(:eth0_bootproto) { "dhcp6" }

      it "sets method6 to 'auto'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("auto")
      end

      it "sets method4 to 'disabled'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("disabled")
      end
    end

    context "when bootproto is set to STATIC" do
      let(:eth0_bootproto) { "static" }

      it "sets method4 to 'manual'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("manual")
      end

      it "sets method6 to 'manual'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("manual")
      end

      context "when IPv6 is disabled" do
        let(:ipv6) { false }

        it "sets method6 to 'disabled'" do
          network = subject.read["network"]
          conn = network["connections"].find { |c| c["id"] == "eth0" }
          expect(conn["method6"]).to eq("disabled")
        end
      end
    end

    context "when bootproto is set to NONE" do
      let(:eth0_bootproto) { "none" }

      it "sets method4 to 'disabled'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method4"]).to eq("disabled")
      end

      it "sets method6 to 'disabled'" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["method6"]).to eq("disabled")
      end
    end

    context "when an IP and a prefix are given" do
      let(:eth0) do
        { name: "eth0", ipaddr: "192.168.122.2", prefixlen: "24" }
      end

      it "includes the IP to the list of addresses" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["addresses"].map(&:to_s)).to eq(["192.168.122.2/24"])
      end
    end

    context "when an IP and a netmask are given" do
      let(:eth0) do
        { name: "eth0", ipaddr: "192.168.122.2", netmask: "255.255.255.0" }
      end

      it "includes the IP to the list of addresses" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
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
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["addresses"].map(&:to_s))
          .to eq(["192.168.122.2/24", "10.0.0.2/8", "192.168.0.2/24"])
      end
    end

    context "when there are wireless settings" do
      let(:eth0) do
        { "name" => "eth0", "wireless_mode" => "wpa-psk" }
      end

      it "includes a 'wireless' key containing those settings" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["wireless"]).to be_a(Hash)
      end
    end

    context "when there are bonding settings" do
      let(:eth0) do
        { "name" => "eth0", "bonding_slave0" => "eth1" }
      end

      it "includes a 'bond' key containing those settings" do
        network = subject.read["network"]
        conn = network["connections"].find { |c| c["id"] == "eth0" }
        expect(conn["bond"]).to be_a(Hash)
      end
    end
  end
end
