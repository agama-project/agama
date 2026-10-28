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
require "agama/autoyast/bridge_reader"

describe Agama::AutoYaST::BridgeReader do
  let(:profile) do
    {
      "name"                 => "br0",
      "bridge"               => "yes",
      "bridge_ports"         => "eth0 eth1",
      "bridge_stp"           => "on",
      "bridge_forward_delay" => "15"
    }
  end

  subject do
    described_class.new(Y2Network::AutoinstProfile::InterfaceSection.new_from_hashes(profile))
  end

  describe "#read" do
    it "sets the ports" do
      bridge = subject.read["bridge"]
      expect(bridge["ports"]).to eq(["eth0", "eth1"])
    end

    it "sets the Spanning Tree Protocol" do
      bridge = subject.read["bridge"]
      expect(bridge["stp"]).to eq(true)
    end

    it "sets the forwarding delay as an integer" do
      bridge = subject.read["bridge"]
      expect(bridge["forwardDelay"]).to eq(15)
    end

    context "when the Spanning Tree Protocol is disabled" do
      let(:profile) do
        { "name" => "br0", "bridge_ports" => "eth0", "bridge_stp" => "off" }
      end

      it "sets the Spanning Tree Protocol to false" do
        bridge = subject.read["bridge"]
        expect(bridge["stp"]).to eq(false)
      end
    end

    context "when the Spanning Tree Protocol is given as 'yes'" do
      let(:profile) do
        { "name" => "br0", "bridge_ports" => "eth0", "bridge_stp" => "yes" }
      end

      it "sets the Spanning Tree Protocol to true" do
        bridge = subject.read["bridge"]
        expect(bridge["stp"]).to eq(true)
      end
    end

    context "when the Spanning Tree Protocol is not given" do
      let(:profile) do
        { "name" => "br0", "bridge_ports" => "eth0" }
      end

      it "does not set the Spanning Tree Protocol" do
        expect(subject.read["bridge"]).to_not have_key("stp")
      end
    end

    context "when the deprecated 'bridge_forwarddelay' spelling is used" do
      let(:profile) do
        { "name" => "br0", "bridge_ports" => "eth0", "bridge_forwarddelay" => "20" }
      end

      it "sets the forwarding delay" do
        bridge = subject.read["bridge"]
        expect(bridge["forwardDelay"]).to eq(20)
      end
    end

    context "when the forwarding delay is negative" do
      let(:profile) do
        { "name" => "br0", "bridge_ports" => "eth0", "bridge_forward_delay" => "-1" }
      end

      it "does not set the forwarding delay" do
        expect(subject.read["bridge"]).to_not have_key("forwardDelay")
      end
    end

    context "when the interface is flagged as a bridge but it has no ports" do
      let(:profile) do
        { "name" => "br0", "bridge" => "yes" }
      end

      it "returns an empty bridge section" do
        expect(subject.read).to eq("bridge" => {})
      end
    end

    context "when the interface has ports but it is not flagged as a bridge" do
      let(:profile) do
        { "name" => "br0", "bridge" => "no", "bridge_ports" => "eth0" }
      end

      it "handles it as a bridge" do
        expect(subject.read).to eq("bridge" => { "ports" => ["eth0"] })
      end
    end

    context "when there is no bridge information" do
      let(:profile) do
        { "name" => "eth0" }
      end

      it "returns an empty hash" do
        expect(subject.read).to eq({})
      end
    end
  end
end
