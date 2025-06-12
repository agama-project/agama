# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/autoyast/iscsi_reader"
require "yast"

Yast.import "Profile"

describe Agama::AutoYaST::IscsiReader do
  subject { described_class.new(profile) }

  describe "#read" do
    context "when there is no 'iscsi-client' section" do
      let(:profile) { Yast::ProfileHash.new({}) }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when the 'iscsi-client' section has no 'initiatorname'" do
      let(:profile) do
        Yast::ProfileHash.new({
          "iscsi-client" => {
            "targets" => []
          }
        })
      end

      it "generates the iSCSI config without 'initiator'" do
        config = subject.read
        expect(config.dig("iscsi", "initiator")).to be_nil
      end
    end

    context "when the 'iscsi-client' section has no 'targets'" do
      let(:profile) do
        Yast::ProfileHash.new({
          "iscsi-client" => {
            "initiatorname" => "iqn.1996-04.com.test:01:351e6d6249"
          }
        })
      end

      it "generates the iSCSI config without 'targets'" do
        config = subject.read
        expect(config.dig("iscsi", "targets")).to be_nil
      end
    end

    context "when the 'iscsi-client' section has 'initiator' and 'targets'" do
      let(:profile) do
        Yast::ProfileHash.new({
          "iscsi-client" => {
            "initiatorname" => "iqn.1996-04.com.test:01:351e6d6249",
            "targets"       => [
              {
                "portal"  => "192.168.100.101:3260",
                "target"  => "iqn.2025-06.com.test:0a5b93b9a9a79ff5db53",
                "iface"   => "default",
                "startup" => "onboot"
              },
              {
                "portal"  => "192.168.100.102:3260",
                "target"  => "iqn.2025-06.com.test:0a5b93b9a9a79ff5db90",
                "iface"   => "default",
                "startup" => "manual"
              }
            ]
          }
        })
      end

      it "generates the expected iSCSI config" do
        config = subject.read
        expect(config).to eq({
          "iscsi" => {
            "initiator" => "iqn.1996-04.com.test:01:351e6d6249",
            "targets"   => [
              {
                "address"   => "192.168.100.101",
                "port"      => 3260,
                "name"      => "iqn.2025-06.com.test:0a5b93b9a9a79ff5db53",
                "interface" => "default",
                "startup"   => "onboot"
              },
              {
                "address"   => "192.168.100.102",
                "port"      => 3260,
                "name"      => "iqn.2025-06.com.test:0a5b93b9a9a79ff5db90",
                "interface" => "default",
                "startup"   => "manual"
              }
            ]
          }
        })
      end
    end
  end
end
