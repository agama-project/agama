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
require "yast"
require "agama/autoyast/zfcp_reader"

Yast.import "Profile"

describe Agama::AutoYaST::ZFCPReader do
  let(:profile) do
    { "zfcp" => { "devices" => devices } }
  end
  let(:devices) { [] }

  subject do
    described_class.new(Yast::ProfileHash.new(profile))
  end

  describe "#read" do
    context "when there is no 'zfcp' section" do
      let(:profile) { {} }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    context "when there are some zfcp devices" do
      let(:devices) do
        [
          {
            "controller_id" => "0.0.fa00",
            "wwpn"          => "0x500507630300c562",
            "lun"           => "0x4010403300000000"
          }
        ]
      end

      it "returns a hash including the 'zfcp' with devices key" do
        expect(subject.read["zfcp"]).to include(
          "devices" => [{
            "channel" => "0.0.fa00",
            "wwpn"    => "0x500507630300c562",
            "lun"     => "0x4010403300000000"
          }]
        )
      end
    end
  end
end
