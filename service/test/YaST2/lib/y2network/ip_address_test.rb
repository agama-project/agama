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
require "y2network/ip_address"

describe Y2Network::IPAddress do
  subject(:ip) { described_class.new("192.168.122.1", 24) }

  describe ".from_string" do
    context "when a string representing an IPv4 is given" do
      let(:ip_address) { "192.168.122.1/24" }

      it "creates an IPAddress object" do
        ip = described_class.from_string(ip_address)
        expect(ip.address).to eq(IPAddr.new("192.168.122.1"))
        expect(ip.prefix).to eq(24)
      end

      context "when no prefix is given" do
        let(:ip_address) { "192.168.122.1" }

        it "does not set a prefix" do
          ip = described_class.from_string(ip_address)
          expect(ip.address).to eq(IPAddr.new("192.168.122.1"))
          expect(ip.prefix).to be_nil
        end
      end
    end

    context "when a string representing an IPv6 is given" do
      let(:ip_address) { "2001:db8:1234:ffff:ffff:ffff:ffff:fff1/48" }

      it "creates an IPAddress object" do
        ip = described_class.from_string(ip_address)
        expect(ip.address).to eq(IPAddr.new("2001:db8:1234:ffff:ffff:ffff:ffff:fff1"))
        expect(ip.prefix).to eq(48)
      end

      context "when no prefix is given" do
        let(:ip_address) { "2001:db8:1234:ffff:ffff:ffff:ffff:fff1" }

        it "does not set a prefix" do
          ip = described_class.from_string(ip_address)
          expect(ip.address).to eq(IPAddr.new(ip_address))
          expect(ip.prefix).to be_nil
        end
      end
    end
  end

  describe "#to_s" do
    subject(:ip) { described_class.new("192.168.122.1", 24) }

    it "returns a string CIDR based representation" do
      expect(ip.to_s).to eq("192.168.122.1/24")
    end

    context "when it is a host address" do
      subject(:ip) { described_class.new("192.168.122.1") }

      it "omits the prefix" do
        expect(ip.to_s).to eq("192.168.122.1")
      end
    end
  end

  describe "#prefix=" do
    it "sets the address prefix" do
      expect { ip.prefix = 32 }.to change { ip.prefix }.from(24).to(32)
    end
  end

  describe "#netmask=" do
    it "sets the address prefix" do
      expect { ip.netmask = "255.255.255.255" }.to change { ip.prefix }.from(24).to(32)
    end
  end

  describe "#==" do
    context "when address and prefix are the same" do
      it "returns true" do
        expect(described_class.new("192.168.122.1", 24))
          .to eq(described_class.new("192.168.122.1", 24))
      end
    end

    context "when addresses are different" do
      it "returns false" do
        expect(described_class.new("192.168.122.1", 24))
          .to_not eq(described_class.new("192.168.122.2", 24))
      end
    end

    context "when prefixes are different" do
      it "returns false" do
        expect(described_class.new("192.168.122.1", 24))
          .to_not eq(described_class.new("192.168.122.1", 32))
      end
    end
  end

  describe "#prefix?" do
    context "when a prefix was set" do
      it "returns true" do
        expect(ip.prefix?).to eq(true)
      end
    end

    context "when a prefix was not set" do
      subject(:ip) { described_class.new("192.168.122.1") }

      it "returns false" do
        expect(ip.prefix?).to eq(false)
      end
    end
  end
end
