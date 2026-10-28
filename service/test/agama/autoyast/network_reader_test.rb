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
require "agama/autoyast/network_reader"

Yast.import "Profile"

describe Agama::AutoYaST::NetworkReader do
  let(:profile) do
    {
      "networking" => {
        "interfaces" => [{ "name" => "eth0" }],
        "dns"        => {
          "nameservers" => ["1.1.1.1"],
          "searchlist"  => ["example.lan"]
        }
      }
    }
  end

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'networking' section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when there is a 'connections' list" do
      it "returns a section with the 'connections' list" do
        network = subject.read
        expect(network["network"].keys).to include("connections")
        network["network"]["connections"].each do |conn|
          expect(conn).to include(
            "nameservers" => ["1.1.1.1"], "dnsSearchList" => ["example.lan"]
          )
        end
      end
    end

    context "when the profile includes 'routing', 'net-udev' and 's390-devices' sections" do
      # None of these sections are surfaced in Agama's own "network" hash (see
      # connections_reader.rb), but Y2Network::AutoinstProfile::NetworkingSection#new_from_hashes
      # unconditionally instantiates them when present, so this just checks parsing the profile
      # does not raise.
      let(:profile) do
        {
          "networking" => {
            "interfaces"   => [{ "name" => "eth0" }],
            "routing"      => {
              "ipv4_forward" => false,
              "routes"       => [
                { "destination" => "192.168.1.0", "device" => "eth0", "gateway" => "-",
                  "netmask" => "-" }
              ]
            },
            "net-udev"     => [
              { "name" => "eth0", "rule" => "KERNELS", "value" => "0000:00:19.0" }
            ],
            "s390-devices" => [
              { "type" => "qeth", "chanids" => "0.0.0800 0.0.0801 0.0.0802" }
            ]
          }
        }
      end

      it "does not raise an error" do
        expect { subject.read }.to_not raise_error
      end
    end
  end
end
