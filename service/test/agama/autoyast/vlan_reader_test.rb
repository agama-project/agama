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

require_relative "../../test_helper"
require "yast"
require "y2network/autoinst_profile/interface_section"
require "agama/autoyast/vlan_reader"

describe Agama::AutoYaST::VlanReader do
  let(:profile) do
    {
      "device"      => "eth0.10",
      "vlan_id"     => "10",
      "etherdevice" => "eth0"
    }
  end

  subject do
    described_class.new(Y2Network::AutoinstProfile::InterfaceSection.new_from_hashes(profile))
  end

  describe "#read" do
    it "sets the VLAN identifier as an integer" do
      vlan = subject.read["vlan"]
      expect(vlan["id"]).to eq(10)
    end

    it "sets the parent interface" do
      vlan = subject.read["vlan"]
      expect(vlan["parent"]).to eq("eth0")
    end

    context "when the 'etherdevice' is not given" do
      let(:profile) do
        { "device" => "eth0.10", "vlan_id" => "10" }
      end

      it "infers the parent interface from the device name" do
        vlan = subject.read["vlan"]
        expect(vlan["parent"]).to eq("eth0")
      end
    end

    context "when the 'vlan_id' is not given" do
      let(:profile) do
        { "device" => "eth0.10", "etherdevice" => "eth0" }
      end

      it "infers the VLAN identifier from the device name" do
        vlan = subject.read["vlan"]
        expect(vlan["id"]).to eq(10)
      end
    end

    context "when the interface is identified by its 'name'" do
      let(:profile) do
        { "name" => "eth0.10", "vlan_id" => "10" }
      end

      it "infers the parent interface from the name" do
        vlan = subject.read["vlan"]
        expect(vlan["parent"]).to eq("eth0")
      end
    end

    context "when the parent interface cannot be determined" do
      let(:profile) do
        { "device" => "vlan10", "vlan_id" => "10" }
      end

      it "returns an empty hash" do
        expect(subject.read).to eq({})
      end
    end

    context "when the VLAN identifier is out of range" do
      let(:profile) do
        { "device" => "eth0.5000", "vlan_id" => "5000", "etherdevice" => "eth0" }
      end

      it "returns an empty hash" do
        expect(subject.read).to eq({})
      end
    end

    context "when there is no VLAN information" do
      let(:profile) do
        { "name" => "eth0" }
      end

      it "returns an empty hash" do
        expect(subject.read).to eq({})
      end
    end
  end
end
