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
require "y2storage"

describe Agama::AutoYaST::Converter do
  let(:profile) { File.join(FIXTURES_PATH, "profiles", profile_name) }
  let(:profile_name) { "simple.xml" }
  let(:workdir) { Dir.mktmpdir }
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
  let(:result_path) { File.join(workdir, "autoinst.json") }
  let(:result) do
    content = File.read(result_path)
    JSON.parse(content)
  end
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
        expect(result["product"]).to include("id" => "Tumbleweed")
      end
    end

    context "when the profile contains some ERB" do
      let(:profile_name) { "simple.xml.erb" }

      it "evaluates the ERB code" do
        subject.to_agama(workdir)
        expect(result["localization"]).to include(
          "languages" => ["en_US.UTF-8", "es_ES.UTF-8"]
        )
      end
    end

    context "when the profile uses rules" do
      let(:profile_name) { "profile/" }

      it "evaluates the rules" do
        subject.to_agama(workdir)
        expect(result["product"]).to include("id" => "Tumbleweed")
      end
    end

    context "when a product is selected" do
      it "exports the selected product" do
        subject.to_agama(workdir)
        expect(result["product"]).to include("id" => "Tumbleweed")
      end
    end

    context "when partitioning is defined" do
      it "exports the drives information" do
        subject.to_agama(workdir)
        expect(result["legacyAutoyastStorage"]).to include({
          "device" => "/dev/vda",
          "use"    => "all"
        })
      end
    end

    context "when the root password and/or public SSH key are set" do
      it "exports the root password and/or public SSH key" do
        subject.to_agama(workdir)
        expect(result["root"]).to include("password" => "nots3cr3t",
          "sshPublicKey" => "ssh-rsa ...")
      end
    end

    context "when a non-system user is defined" do
      it "exports the user information" do
        subject.to_agama(workdir)
        expect(result["user"]).to include("userName" => "jane",
          "password" => "12345678", "fullName" => "Jane Doe")
      end
    end

    it "exports localization settings" do
      subject.to_agama(workdir)
      expect(result["localization"]).to include(
        "languages" => ["en_US.UTF-8"],
        "timezone"  => "Atlantic/Canary",
        "keyboard"  => "us"
      )
    end
  end

  context "when an invalid profile is given" do
    let(:xml_valid?) { false }
    let(:xml_errors) { ["Some validation error"] }
    let(:profile_name) { "invalid.xml" }

    it "reports the problem" do
      expect(Yast2::Popup).to receive(:show)
      subject.to_agama(workdir)
    end
  end

  context "for cloned profile" do
    let(:profile_name) { "cloned.xml" }

    it "generate json according to schema" do
      # sadly rubygem-json-schema cannot be used due to too old supported format
      if !system("which jsonschema")
        pending "can run only if python3-jsonschema is installed"
        break
      end

      subject.to_agama(workdir)

      schema = File.expand_path(
        "../../../../rust/agama-lib/share/profile.schema.json",
        __dir__
      )

      # filter out deprecation warning as check-jsonschema is not packaged for TW yet
      result = `jsonschema -i '#{result_path}' '#{schema}' 2>&1 | \
        grep -v 'DeprecationWarning' | \
        grep -v 'from jsonschema.cli import main'`
      expect(result).to eq ""
    end
  end
end
