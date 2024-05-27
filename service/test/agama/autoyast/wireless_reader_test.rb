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
require "y2network/wireless_auth_mode"
require "y2network/wireless_mode"
require "agama/autoyast/wireless_reader"

Yast.import "Profile"

describe Agama::AutoYaST::WirelessReader do
  let(:profile) do
    {
      "wireless_auth_mode" => auth_mode,
      "wireless_mode"      => mode,
      "wireless_essid"     => "DUMMY_NETWORK"
    }
  end

  let(:auth_mode) { Y2Network::WirelessAuthMode::NONE }
  let(:mode) { Y2Network::WirelessMode::MANAGED }

  subject do
    described_class.new(Y2Network::AutoinstProfile::InterfaceSection.new_from_hashes(profile))
  end

  describe "#read" do
    it "sets the ssid" do
      result = subject.read["wireless"]
      expect(result["ssid"]).to eq("DUMMY_NETWORK")
    end

    context "when wireless_auth_mode is WPA_PSK" do
      let(:auth_mode) { Y2Network::WirelessAuthMode::WPA_PSK }

      it "sets 'wpa-psk' as security protocol" do
        result = subject.read["wireless"]
        expect(result["security"]).to eq("wpa-psk")
      end
    end

    context "when wireless_auth_mode is WPA_PSK" do
      let(:auth_mode) { Y2Network::WirelessAuthMode::WPA_EAP }

      it "sets 'wpa-eap' as security protocol" do
        result = subject.read["wireless"]
        expect(result["security"]).to eq("wpa-eap")
      end
    end

    context "when wireless_auth_mode is WEP" do
      let(:auth_mode) { Y2Network::WirelessAuthMode::WEP_OPEN }

      it "sets 'none' as security protocol" do
        result = subject.read["wireless"]
        expect(result["security"]).to eq("none")
      end
    end

    context "when wireless_mode is AD_HOC" do
      let(:mode) { Y2Network::WirelessMode::AD_HOC }

      it "sets 'adhoc' as mode" do
        result = subject.read["wireless"]
        expect(result["mode"]).to eq("adhoc")
      end
    end

    context "when wireless_mode is MASTER" do
      let(:mode) { Y2Network::WirelessMode::MASTER }

      it "sets 'ap' as mode" do
        result = subject.read["wireless"]
        expect(result["mode"]).to eq("ap")
      end
    end

    context "when wireless_mode is MANAGED" do
      let(:mode) { Y2Network::WirelessMode::MANAGED }

      it "sets 'infrastructure' as mode" do
        result = subject.read["wireless"]
        expect(result["mode"]).to eq("infrastructure")
      end
    end
  end
end
