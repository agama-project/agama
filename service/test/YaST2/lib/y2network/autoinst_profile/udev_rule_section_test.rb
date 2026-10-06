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
require "y2network/autoinst_profile/udev_rule_section"
require "y2network/autoinst_profile/networking_section"

describe Y2Network::AutoinstProfile::UdevRuleSection do
  subject(:section) { described_class.new }

  describe ".new_from_network" do
    # Y2Network::Hwinfo and Y2Network::Interface are not vendored (see service/YaST2/README.md).
    # #init_from_config only relies on a handful of duck-typed methods, so plain doubles (named
    # with a string instead of the unavailable constants) stand in for them.
    let(:hardware) do
      double("Y2Network::Hwinfo", mac: "mac1", busid: "bus1")
    end
    let(:interface) do
      double("Y2Network::Interface", renaming_mechanism: :mac, hardware: hardware, name: "eth0")
    end

    let(:parent) { double("Installation::AutoinstProfile::SectionWithAttributes") }

    it "initializes values properly" do
      section = described_class.new_from_network(interface)
      expect(section.name).to eq "eth0"
      expect(section.value).to eq "mac1"
      expect(section.rule).to eq "ATTR{address}"
    end

    it "sets the parent section" do
      section = described_class.new_from_network(interface, parent)
      expect(section.parent).to eq(parent)
    end
  end

  describe "#section_path" do
    let(:networking) do
      Y2Network::AutoinstProfile::NetworkingSection.new_from_hashes(
        "net-udev" => [{ "name" => "eth0" }]
      )
    end

    subject(:section) { networking.udev_rules.udev_rules.first }

    it "returns the section path" do
      expect(section.section_path.to_s).to eq("networking,net-udev,0")
    end
  end
end
