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
require "y2network/autoinst_profile/udev_rules_section"

describe Y2Network::AutoinstProfile::UdevRulesSection do
  subject(:section) { described_class.new }

  describe ".new_from_network" do
    # Y2Network::Hwinfo and Y2Network::Interface are not vendored (see service/YaST2/README.md).
    # #init_from_config (on the nested UdevRuleSection) only relies on a handful of duck-typed
    # methods, so plain doubles (named with a string instead of the unavailable constants) stand
    # in for them.
    let(:hardware) do
      double("Y2Network::Hwinfo", mac: "mac1", busid: "bus1")
    end
    let(:interface) do
      double("Y2Network::Interface", renaming_mechanism: :mac, hardware: hardware, name: "eth0")
    end

    let(:parent) { double("Installation::AutoinstProfile::SectionWithAttributes") }

    it "initializes the list of udev rules" do
      section = described_class.new_from_network([interface])
      expect(section.udev_rules)
        .to contain_exactly(a_kind_of(Y2Network::AutoinstProfile::UdevRuleSection))
    end

    it "sets the parent section" do
      section = described_class.new_from_network([interface], parent)
      expect(section.parent).to eq(parent)
    end
  end

  # No upstream ".new_from_hashes" examples exist for this class (only ".new_from_network" is
  # tested upstream). Written from scratch, mirroring the hash shapes used by
  # networking_section_test.rb and the actual (vendored) #init_from_hashes/#udev_rules_from_hash
  # implementation, since this is the path Agama's AutoYaST network reader actually relies on
  # (see service/YaST2/README.md).
  describe ".new_from_hashes" do
    let(:hash) do
      [
        { "name" => "eth0", "rule" => "ATTR{address}", "value" => "00:30:6E:08:EC:80" },
        { "name" => "eth1", "rule" => "KERNELS", "value" => "0000:00:19.0" }
      ]
    end

    it "returns one udev rule section for each entry" do
      section = described_class.new_from_hashes(hash)
      expect(section.udev_rules.size).to eq(2)
      expect(section.udev_rules).to all(be_a(Y2Network::AutoinstProfile::UdevRuleSection))
    end

    it "initializes each rule section with the corresponding values" do
      section = described_class.new_from_hashes(hash)
      rule0 = section.udev_rules.first
      expect(rule0.name).to eq("eth0")
      expect(rule0.rule).to eq("ATTR{address}")
      expect(rule0.value).to eq("00:30:6E:08:EC:80")
    end

    context "when no rules are defined" do
      let(:hash) { [] }

      it "returns an empty list" do
        section = described_class.new_from_hashes(hash)
        expect(section.udev_rules).to eq([])
      end
    end
  end

  describe "#section_name" do
    it "returns 'net-udev'" do
      expect(section.section_name).to eq("net-udev")
    end
  end
end
