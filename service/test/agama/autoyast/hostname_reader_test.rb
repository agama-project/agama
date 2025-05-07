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
require "agama/autoyast/hostname_reader"

Yast.import "Profile"

describe Agama::AutoYaST::HostnameReader do
  let(:profile) do
    {
      "networking" => {
        "dns" => {
          "hostname" => "host.example.lan"
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

    context "when there is no 'hostname' property" do
      let(:profile) { { "networking" => {} } }

      it "returns an empty hash" do
        expect(subject.read).to be_empty
      end
    end

    it "returns a hash containing the hostname" do
      expect(subject.read["hostname"]).to eq("static" => "host.example.lan")
    end
  end
end
