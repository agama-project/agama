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
require "y2network/autoinst_profile/interface_section"
require "y2network/autoinst_profile/networking_section"

# NOTE: upstream's ".new_from_network" examples are not ported. `InterfaceSection#init_from_config`
# unconditionally runs a `case config; when ConnectionConfig::Vlan; when
# ConnectionConfig::Bridge...` statement, which references `Y2Network::ConnectionConfig` - a
# module that is NOT vendored (see service/YaST2/README.md) and is not defined anywhere else in
# this codebase either. Evaluating a `when` clause requires resolving its constant even when it is
# not the matching branch, so calling `.new_from_network`/`#init_from_config` on *any* config
# object currently raises `NameError: uninitialized constant
# Y2Network::AutoinstProfile::ConnectionConfig` - this is a genuine bug in the vendored code (see
# the final report), left unfixed since Agama itself never calls `.new_from_network` (confirmed:
# no callers under service/lib).
describe Y2Network::AutoinstProfile::InterfaceSection do
  subject(:section) { described_class.new }

  describe ".new_from_hashes" do
    let(:hash) do
      {
        "bootproto" => "dhcp4",
        "device"    => "eth0",
        "startmode" => "auto"
      }
    end

    let(:parent) { double("parent section") }

    it "loads properly boot protocol" do
      section = described_class.new_from_hashes(hash)
      expect(section.bootproto).to eq "dhcp4"
    end

    it "sets the parent section" do
      section = described_class.new_from_hashes(hash, parent)
      expect(section.parent).to eq(parent)
    end

    context "when bridge_forwarddelay is set" do
      let(:hash) do
        {
          "bootproto"           => "dhcp4",
          "device"              => "br0",
          "bridge_forwarddelay" => "4"
        }
      end

      it "sets bridge_forward_delay to the given value" do
        section = described_class.new_from_hashes(hash)
        expect(section.bridge_forward_delay).to eq("4")
      end
    end

    context "when the device and name are given" do
      let(:descr) { "Virtual Interface Card 4" }

      it "sets the device as the name and the name as the description" do
        hash["name"] = descr
        section = described_class.new_from_hashes(hash)
        expect(section.name).to eq("eth0")
        expect(section.description).to eq(descr)
      end
    end

    context "when bridge_forwarddelay and bridge_forward_delay are both set" do
      let(:hash) do
        {
          "bootproto"            => "dhcp4",
          "device"               => "br0",
          "bridge_forwarddelay"  => "4",
          "bridge_forward_delay" => "5"
        }
      end

      it "bridge_forward_delay takes precedence" do
        section = described_class.new_from_hashes(hash)
        expect(section.bridge_forward_delay).to eq("5")
      end
    end

    context "when the aliases are declared as an string" do
      let(:hash) do
        {
          "device"  => "eth0",
          "aliases" => ""
        }
      end

      it "does not break and initializes the aliases as an empty hash" do
        section = described_class.new_from_hashes(hash)
        expect(section.aliases).to eql([])
      end
    end
  end

  describe "#to_hashes" do
    subject(:section) do
      described_class.new_from_hashes(
        "device"  => "eth0",
        "aliases" => aliases_hash
      )
    end

    let(:aliases_hash) do
      { "alias0" => { "ipaddr" => "10.100.0.1", "prefixlen" => "24" } }
    end

    it "exports the aliases key" do
      expect(section.to_hashes["aliases"]).to eq(aliases_hash)
    end

    context "when the list of aliases is empty" do
      subject(:section) do
        described_class.new_from_hashes("device" => "eth0", "aliases" => {})
      end

      it "does not export the aliases key" do
        expect(section.to_hashes).to_not have_key("aliases")
      end
    end
  end

  describe "#wireless_keys" do
    it "returns array" do
      section = described_class.new_from_hashes({})
      expect(section.wireless_keys).to be_a Array
    end

    it "return each defined wireless key" do
      hash = {
        "wireless_key1" => "test1",
        "wireless_key3" => "test3"
      }

      section = described_class.new_from_hashes(hash)
      expect(section.wireless_keys).to eq ["test1", "test3"]
    end
  end

  describe "#bonding_slaves" do
    it "returns array" do
      section = described_class.new_from_hashes({})
      expect(section.bonding_slaves).to be_a Array
    end

    it "return each defined wireless key" do
      hash = {
        "bonding_slave1" => "eth0",
        "bonding_slave3" => "eth1"
      }

      section = described_class.new_from_hashes(hash)
      expect(section.bonding_slaves).to eq ["eth0", "eth1"]
    end
  end

  describe "#section_path" do
    let(:networking) do
      Y2Network::AutoinstProfile::NetworkingSection.new_from_hashes(
        "interfaces" => [{ "device" => "eth0" }]
      )
    end

    subject(:section) { networking.interfaces.interfaces.first }

    it "returns the section path" do
      expect(section.section_path.to_s).to eq("networking,interfaces,0")
    end
  end
end
