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
require "y2network/autoinst_profile/interfaces_section"
require "y2network/autoinst_profile/networking_section"

# No dedicated upstream test exists for this class (see the task description), so these examples
# are written from scratch. They mirror the profile hash shapes used (indirectly, via
# NetworkingSection.new_from_hashes) by networking_section_test.rb and interface_section_test.rb,
# and exercise the actual (vendored) #init_from_hashes/#interfaces_from_hash implementation, since
# that is the path Agama's AutoYaST network reader (service/lib/agama/autoyast/network_reader.rb)
# actually relies on.
describe Y2Network::AutoinstProfile::InterfacesSection do
  subject(:section) { described_class.new }

  describe ".new_from_network" do
    let(:parent) { double("parent section") }

    # NOTE: only the empty-collection case is exercised here. For any non-empty collection,
    # `InterfaceSection.new_from_network` (called internally for each connection config) hits a
    # genuine bug in the vendored code - see interface_section_test.rb and the final report.
    it "initializes an empty list of interfaces when there are no connection configs" do
      section = described_class.new_from_network([])
      expect(section.interfaces).to eq([])
    end

    it "sets the parent section" do
      section = described_class.new_from_network([], parent)
      expect(section.parent).to eq(parent)
    end
  end

  describe ".new_from_hashes" do
    let(:hash) do
      [
        { "bootproto" => "dhcp", "device" => "eth0", "startmode" => "auto" },
        {
          "bootproto"   => "static",
          "broadcast"   => "127.255.255.255",
          "device"      => "lo",
          "firewall"    => "no",
          "ipaddr"      => "127.0.0.1",
          "netmask"     => "255.0.0.0",
          "network"     => "127.0.0.0",
          "prefixlen"   => "8",
          "startmode"   => "nfsroot",
          "usercontrol" => "no"
        }
      ]
    end

    it "returns one interface section for each entry" do
      section = described_class.new_from_hashes(hash)
      expect(section.interfaces.size).to eq(2)
      expect(section.interfaces).to all(be_a(Y2Network::AutoinstProfile::InterfaceSection))
    end

    it "initializes each interface section with the corresponding values" do
      section = described_class.new_from_hashes(hash)
      eth0 = section.interfaces.first
      expect(eth0.device).to eq("eth0")
      expect(eth0.bootproto).to eq("dhcp")
      expect(eth0.startmode).to eq("auto")
    end

    it "sets itself as the parent of each interface section" do
      section = described_class.new_from_hashes(hash)
      expect(section.interfaces).to all(have_attributes(parent: section))
    end

    context "when an entry is wrapped in a 'device' hash" do
      let(:hash) do
        [{ "device" => { "bootproto" => "dhcp", "device" => "eth0" } }]
      end

      it "unwraps it before initializing the interface section" do
        section = described_class.new_from_hashes(hash)
        expect(section.interfaces.size).to eq(1)
        expect(section.interfaces.first.device).to eq("eth0")
      end
    end

    context "when the list contains non-hash entries" do
      let(:hash) do
        [
          "not-a-hash",
          { "bootproto" => "dhcp", "device" => "eth0" }
        ]
      end

      it "ignores them" do
        section = described_class.new_from_hashes(hash)
        expect(section.interfaces.size).to eq(1)
        expect(section.interfaces.first.device).to eq("eth0")
      end
    end

    context "when no interfaces are defined" do
      let(:hash) { [] }

      it "returns an empty list" do
        section = described_class.new_from_hashes(hash)
        expect(section.interfaces).to eq([])
      end
    end
  end

  describe "#section_path" do
    let(:networking) do
      Y2Network::AutoinstProfile::NetworkingSection.new_from_hashes(
        "interfaces" => [{ "device" => "eth0" }]
      )
    end

    subject(:section) { networking.interfaces }

    it "returns the section path" do
      expect(section.section_path.to_s).to eq("networking,interfaces")
    end
  end
end
