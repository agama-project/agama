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
require "autoinstall/xml_checks"

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
    stub_const("Y2Autoinstallation::XmlChecks::ERRORS_PATH", File.join(tmpdir, "errors"))
    Yast.import "Installation"
    allow(Yast::Installation).to receive(:sourcedir).and_return(File.join(tmpdir, "mount"))
    allow(Yast::AutoinstConfig).to receive(:scripts_dir)
      .and_return(File.join(tmpdir, "scripts"))
    allow(Yast::AutoinstConfig).to receive(:profile_dir)
      .and_return(File.join(tmpdir, "profile"))
    allow(Yast::AutoinstConfig).to receive(:modified_profile)
      .and_return(File.join(tmpdir, "profile", "modified.xml"))
  end

  after do
    FileUtils.remove_entry(workdir)
    FileUtils.remove_entry(tmpdir)
  end

  subject do
    described_class.new("file://#{profile}")
  end

  describe "#to_agama" do
    context "when some pre-script is defined" do
      let(:profile_name) { "pre-scripts.xml" }
      let(:profile) { File.join(tmpdir, profile_name) }

      before do
        allow(Yast::AutoinstConfig).to receive(:scripts_dir)
          .and_return(File.join(tmpdir, "scripts"))
        allow(Yast::AutoinstConfig).to receive(:profile_dir)
          .and_return(File.join(tmpdir, "profile"))

        # Adapt the script to use the new tmp directory
        profile_content = File.read(File.join(FIXTURES_PATH, "profiles", profile_name))
        profile_content.gsub!("/tmp/profile/", "#{tmpdir}/profile/")
        File.write(profile, profile_content)
      end

      it "runs the script" do
        subject.to_agama(workdir)
        expect(result["software"]).to include("product" => "Tumbleweed")
      end
    end

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

  context "when an invalid profile is given" do
    let(:profile_name) { "invalid.xml" }

    it "reports the problem" do
      expect(Yast2::Popup).to receive(:show)
      subject.to_agama(workdir)
    end
  end
end
