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
require "y2network/autoinst_profile/s390_device_section"
require "y2network/autoinst_profile/networking_section"

# NOTE: upstream's ".new_from_network" examples are not ported. `S390DeviceSection#init_from_config`
# unconditionally runs a `case config; when ConnectionConfig::Qeth; when ConnectionConfig::Ctc...`
# statement, which references `Y2Network::ConnectionConfig` - a module that is NOT vendored (see
# service/YaST2/README.md) and is not defined anywhere else in this codebase either. Evaluating a
# `when` clause requires resolving its constant even when it is not the matching branch, so calling
# `.new_from_network`/`#init_from_config` on *any* config object currently raises
# `NameError: uninitialized constant Y2Network::AutoinstProfile::ConnectionConfig` - this is a
# genuine bug in the vendored code (see the final report), left unfixed since Agama itself never
# calls `.new_from_network` (confirmed: no callers under service/lib).
describe Y2Network::AutoinstProfile::S390DeviceSection do
  subject(:section) { described_class.new }

  describe ".new_from_hashes" do
    let(:hash) do
      {
        "type"     => "ctc",
        "chanids"  => "0.0.0800:0.0.0801",
        "protocol" => "1"
      }
    end

    it "loads properly type, chanids and boot protocol" do
      section = described_class.new_from_hashes(hash)
      expect(section.type).to eq "ctc"
      expect(section.chanids).to eq("0.0.0800:0.0.0801")
      expect(section.protocol).to eq "1"
    end

    context "using the old syntax for chanids" do
      let(:hash) do
        {
          "type"     => "ctc",
          "chanids"  => "0.0.0800 0.0.0801",
          "protocol" => "1"
        }
      end

      it "loads properly the chanids" do
        section = described_class.new_from_hashes(hash)
        expect(section.chanids).to eq("0.0.0800:0.0.0801")
      end
    end
  end

  describe "#section_path" do
    let(:networking) do
      Y2Network::AutoinstProfile::NetworkingSection.new_from_hashes(
        "s390-devices" => [{ "type" => "qeth" }]
      )
    end

    subject(:section) { networking.s390_devices.devices.first }

    it "returns the section path" do
      expect(section.section_path.to_s).to eq("networking,s390-devices,0")
    end
  end
end
