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
require "agama/autoyast/converter"
require "json"
require "tmpdir"

describe Agama::AutoYaST::Converter do
  let(:profile) { File.join(FIXTURES_PATH, "profiles", profile_name) }
  let(:profile_name) { "simple.xml" }
  let(:workdir) { Dir.mktmpdir }
  let(:tmpdir) { Dir.mktmpdir }
  let(:result) do
    content = File.read(File.join(workdir, "autoinst.json"))
    JSON.parse(content)
  end

  before do
    Yast.import "Installation"
    allow(Yast::Installation).to receive(:sourcedir).and_return(File.join(tmpdir, "mount"))
  end

  after do
    FileUtils.remove_entry(workdir)
    FileUtils.remove_entry(tmpdir)
  end

  subject do
    described_class.new("file://#{profile}")
  end

  describe "#to_agama" do
    context "when a product is selected" do
      it "exports the selected product" do
        subject.to_agama(workdir)
        expect(result["software"]).to include("product" => "Tumbleweed")
      end
    end

    context "when a storage device is selected" do
      it "exports the device" do
        subject.to_agama(workdir)
        expect(result["storage"]).to include("bootDevice" => "/dev/vda")
      end
    end
  end
end
