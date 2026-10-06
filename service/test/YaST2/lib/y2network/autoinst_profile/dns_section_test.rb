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
require "y2network/autoinst_profile/dns_section"

describe Y2Network::AutoinstProfile::DNSSection do
  subject(:section) { described_class.new }

  describe ".new_from_network" do
    # Y2Network::DNS and Y2Network::Hostname are not vendored (see service/YaST2/README.md).
    # #init_from_network only relies on a handful of duck-typed methods, so plain doubles are
    # used here instead of the (unavailable) `instance_double`.
    let(:dns) do
      double("Y2Network::DNS",
        resolv_conf_policy: "auto",
        nameservers:        nameservers,
        searchlist:         searchlist)
    end
    let(:hostname) do
      double("Y2Network::Hostname",
        hostname:      "linux",
        dhcp_hostname: :any)
    end

    let(:nameservers) { [IPAddr.new("1.1.1.1")] }
    let(:searchlist) { ["example.net"] }
    let(:parent) { double("Installation::AutoinstProfile::SectionWithAttributes") }

    it "sets the hostname attribute" do
      section = described_class.new_from_network(dns, hostname)
      expect(section.hostname).to eq("linux")
    end

    it "sets the dhcp_hostname attribute" do
      section = described_class.new_from_network(dns, hostname)
      expect(section.dhcp_hostname).to eq(true)
    end

    it "sets the resolv_conf_policy attribute" do
      section = described_class.new_from_network(dns, hostname)
      expect(section.resolv_conf_policy).to eq("auto")
    end

    it "sets the nameservers attribute" do
      section = described_class.new_from_network(dns, hostname)
      expect(section.nameservers).to eq(["1.1.1.1"])
    end

    it "sets the searchlist attribute" do
      section = described_class.new_from_network(dns, hostname)
      expect(section.searchlist).to eq(["example.net"])
    end

    it "sets the parent section" do
      section = described_class.new_from_network(dns, hostname, parent)
      expect(section.parent).to eq(parent)
    end
  end

  describe "#.new_from_hashes" do
    let(:hash) do
      {
        "hostname"           => "linux.example.org",
        "dhcp_hostname"      => true,
        "resolv_conf_policy" => "auto",
        "nameservers"        => ["192.168.122.1", "10.0.0.1"],
        "searchlist"         => ["suse.com"]
      }
    end

    let(:minimal_hash) do
      {
        "dhcp_hostname"      => true,
        "resolv_conf_policy" => "auto"
      }
    end

    it "initializes the hostname" do
      section = described_class.new_from_hashes(hash)
      expect(section.hostname).to eq("linux.example.org")
    end

    it "initializes dhcp_hostname" do
      section = described_class.new_from_hashes(hash)
      expect(section.dhcp_hostname).to eq(true)
    end

    it "initializes resolv_conf_policy" do
      section = described_class.new_from_hashes(hash)
      expect(section.resolv_conf_policy).to eq("auto")
    end

    it "initializes the list of nameservers" do
      section = described_class.new_from_hashes(hash)
      expect(section.nameservers.size).to eql(2)
      expect(section.nameservers).to include("10.0.0.1")
    end

    it "initializes searchlist" do
      section = described_class.new_from_hashes(hash)
      expect(section.searchlist).to eql(["suse.com"])
    end

    context "when scalar attributes are not defined" do
      it "does not set the attribute" do
        section = described_class.new_from_hashes(minimal_hash)
        expect(section.hostname).to be_nil
      end
    end

    context "when an array attribute is not defined" do
      it "is initialized as empty" do
        section = described_class.new_from_hashes(minimal_hash)
        expect(section.nameservers).to be_empty
        expect(section.nameservers).to be_a(Array)
      end
    end
  end
end
