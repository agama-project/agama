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
require "agama/autoyast/profile_fetcher"
require "json"
require "tmpdir"
require "autoinstall/xml_checks"
require "y2storage"

Yast.import "ProfileLocation"

describe Agama::AutoYaST::ProfileFetcher do
  let(:profile) { File.join(FIXTURES_PATH, "profiles", profile_name) }
  let(:profile_name) { "simple.xml" }
  let(:tmpdir) { Dir.mktmpdir }
  let(:xml_validator) do
    instance_double(
      Y2Autoinstallation::XmlValidator,
      valid?: xml_valid?,
      errors: xml_errors
    )
  end
  let(:xml_valid?) { true }
  let(:xml_errors) { [] }
  let(:storage_manager) do
    instance_double(
      Y2Storage::StorageManager,
      probed:               storage_probed,
      probed_disk_analyzer: disk_analyzer
    )
  end
  let(:storage_probed) do
    instance_double(Y2Storage::Devicegraph, disks: [])
  end
  let(:disk_analyzer) do
    instance_double(Y2Storage::DiskAnalyzer, windows_partitions: [], linux_partitions: [])
  end

  before do
    stub_const("Y2Autoinstallation::XmlChecks::ERRORS_PATH", File.join(tmpdir, "errors"))
    stub_const("Agama::AutoYaST::PreScript::SCRIPTS_DIR", File.join(tmpdir, "scripts"))
    Yast.import "Installation"
    allow(Yast::Installation).to receive(:sourcedir).and_return(File.join(tmpdir, "mount"))
    allow(Yast::AutoinstConfig).to receive(:scripts_dir)
      .and_return(File.join(tmpdir, "scripts"))
    allow(Yast::AutoinstConfig).to receive(:profile_dir)
      .and_return(File.join(tmpdir, "profile"))
    allow(Yast::AutoinstConfig).to receive(:modified_profile)
      .and_return(File.join(tmpdir, "profile", "modified.xml"))
    allow(Y2Autoinstallation::XmlValidator).to receive(:new).and_return(xml_validator)
    allow(Y2Storage::StorageManager).to receive(:instance).and_return(storage_manager)
  end

  after do
    FileUtils.remove_entry(tmpdir)
  end

  subject do
    described_class.new("file://#{profile}")
  end

  describe "#fetch" do
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
        result = subject.fetch
        expect(result["software"]).to include("products" => ["Tumbleweed"])
      end
    end

    context "when the profile contains some ERB" do
      let(:profile_name) { "simple.xml.erb" }

      it "evaluates the ERB code" do
        result = subject.fetch
        expect(result["language"]).to include(
          "language" => "en_US"
        )
      end
    end

    context "when the profile uses rules" do
      let(:profile_name) { "profile/" }

      it "evaluates the rules" do
        result = subject.fetch
        expect(result["software"]).to include("products" => ["Tumbleweed"])
      end
    end

    context "when it cannot download the profile" do
      before do
        allow(Yast::ProfileLocation).to receive(:Process).and_return(false)
      end

      it "returns nil" do
        expect(subject.fetch).to be_nil
      end

      it "does not process the profile" do
        expect(Yast::Profile).to_not receive(:ReadXML)
        subject.fetch
      end
    end
  end

  context "when an invalid profile is given" do
    let(:xml_valid?) { false }
    let(:xml_errors) { ["Some validation error"] }
    let(:profile_name) { "invalid.xml" }

    it "reports the problem" do
      expect(Yast2::Popup).to receive(:show)
      subject.fetch
    end
  end
end
