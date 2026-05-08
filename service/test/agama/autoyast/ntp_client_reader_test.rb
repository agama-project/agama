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
require "agama/autoyast/ntp_client_reader"

Yast.import "Profile"

describe Agama::AutoYaST::NtpClientReader do
  let(:profile) do
    {
      "ntp-client" => {
        "ntp_servers" => [
          server1
        ]
      }
    }
  end

  let(:server1) do
    { "address" => "cz.pool.ntp.org", "iburst" => true, "offline" => false }
  end

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'ntp-client' section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    it "returns a hash containing the 'ntp' section with the given servers as pools" do
      expect(subject.read["ntp"]).to eq("sources" => [server1.merge("type" => "pool")])
    end
  end
end
