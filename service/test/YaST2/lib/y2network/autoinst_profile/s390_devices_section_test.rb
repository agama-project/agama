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
require "y2network/autoinst_profile/s390_devices_section"

# NOTE: upstream's ".new_from_network" examples are not ported. They build a real
# `Y2Network::ConnectionConfig::Qeth` config and feed it to `.new_from_network`, which (via
# `S390DeviceSection.new_from_network`/`#init_from_config`) unconditionally runs a
# `case config; when ConnectionConfig::Qeth...` statement. `Y2Network::ConnectionConfig` is a
# module that is NOT vendored (see service/YaST2/README.md) and is not defined anywhere else in
# this codebase either, so resolving that `when` clause currently raises
# `NameError: uninitialized constant Y2Network::AutoinstProfile::ConnectionConfig` - this is a
# genuine bug in the vendored code (see the final report), left unfixed since Agama itself never
# calls `.new_from_network` (confirmed: no callers under service/lib).
#
# ".new_from_hashes" examples are written from scratch instead, mirroring the hash shapes used by
# networking_section_test.rb and the actual (vendored) #init_from_hashes/#devices_from_hash
# implementation, since this is the path Agama's AutoYaST network reader actually relies on.
describe Y2Network::AutoinstProfile::S390DevicesSection do
  subject(:section) { described_class.new }

  describe ".new_from_hashes" do
    let(:hash) do
      [
        { "type" => "qeth", "chanids" => "0.0.0700:0.0.0701:0.0.0702", "layer2" => true },
        { "type" => "ctc", "chanids" => "0.0.0800:0.0.0801" }
      ]
    end

    it "returns one device section for each entry" do
      section = described_class.new_from_hashes(hash)
      expect(section.devices.size).to eq(2)
      expect(section.devices).to all(be_a(Y2Network::AutoinstProfile::S390DeviceSection))
    end

    it "initializes each device section with the corresponding values" do
      section = described_class.new_from_hashes(hash)
      device0 = section.devices.first
      expect(device0.type).to eq("qeth")
      expect(device0.chanids).to eq("0.0.0700:0.0.0701:0.0.0702")
      expect(device0.layer2).to eq(true)
    end

    context "when an entry is wrapped in a 'device' hash" do
      let(:hash) do
        [{ "device" => { "type" => "qeth", "chanids" => "0.0.0700:0.0.0701:0.0.0702" } }]
      end

      it "unwraps it before initializing the device section" do
        section = described_class.new_from_hashes(hash)
        expect(section.devices.size).to eq(1)
        expect(section.devices.first.type).to eq("qeth")
      end
    end

    context "when no devices are defined" do
      let(:hash) { [] }

      it "returns an empty list" do
        section = described_class.new_from_hashes(hash)
        expect(section.devices).to eq([])
      end
    end
  end

  describe "#section_name" do
    it "returns 's390-devices'" do
      expect(section.section_name).to eq("s390-devices")
    end
  end
end
