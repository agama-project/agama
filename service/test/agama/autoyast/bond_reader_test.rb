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
require "y2network/autoinst_profile/interface_section"
require "agama/autoyast/bond_reader"

describe Agama::AutoYaST::BondReader do
  let(:profile) do
    {
      "id"                  => "bond0",
      "bonding_slave0"      => "eth0",
      "bonding_slave1"      => "eth1",
      "bonding_module_opts" => "some-option=true mode=active-backup miimon=100"
    }
  end

  subject do
    described_class.new(Y2Network::AutoinstProfile::InterfaceSection.new_from_hashes(profile))
  end

  describe "#read" do
    it "sets the ports" do
      bond = subject.read["bond"]
      expect(bond["ports"]).to eq(["eth0", "eth1"])
    end

    it "sets the options" do
      bond = subject.read["bond"]
      expect(bond["options"]).to eq("some-option=true miimon=100")
    end

    it "sets the mode" do
      bond = subject.read["bond"]
      expect(bond["mode"]).to eq("active-backup")
    end
  end
end
