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
require "agama/autoyast/converter"
require "json"
require "tmpdir"
require "tempfile"
require "autoinstall/xml_checks"
require "y2storage"

Yast.import "Profile"

describe Agama::AutoYaST::Converter do
  let(:profile) do
    Yast::Profile.ReadXML(
      File.join(FIXTURES_PATH, "profiles", profile_name)
    )
    Yast::Profile.current
  end

  let(:profile_name) { "simple.xml" }

  subject do
    described_class.new
  end

  describe "#to_agama" do
    context "when profile contains both scripts and services-manager sections" do
      let(:profile_name) { "services-manager.xml" }

      it "merges post scripts together" do
        result = subject.to_agama(profile)

        expect(result).to have_key("scripts")
        expect(result["scripts"]).to have_key("post")
        expect(result["scripts"]["post"].length).to eq 2
      end
    end

    context "when a product is selected" do
      it "exports the selected product" do
        result = subject.to_agama(profile)
        expect(result["product"]).to include("id" => "Tumbleweed")
      end
    end

    context "when partitioning is defined" do
      it "exports the drives information" do
        result = subject.to_agama(profile)
        expect(result["legacyAutoyastStorage"]).to include({
          "device" => "/dev/vda",
          "use"    => "all"
        })
      end
    end

    context "when iscsi-client is defined" do
      let(:profile_name) { "iscsi.xml" }

      it "exports the iscsi information" do
        result = subject.to_agama(profile)
        expect(result["iscsi"]).to eq({
          "initiator" => "iqn.2013-02.de.suse:01:e229358d2dea",
          "targets"   => [
            {
              "address"   => "192.168.1.1",
              "port"      => 3260,
              "name"      => "iqn.2001-05.com.doe:test",
              "interface" => "default",
              "startup"   => "onboot"
            }
          ]
        })
      end
    end

    context "when the root password and/or public SSH key are set" do
      it "exports the root password and/or public SSH key" do
        result = subject.to_agama(profile)
        expect(result["root"]).to include("password" => "nots3cr3t",
          "sshPublicKey" => "ssh-rsa ...")
      end
    end

    context "when a non-system user is defined" do
      it "exports the user information" do
        result = subject.to_agama(profile)
        expect(result["user"]).to include("userName" => "jane",
          "password" => "12345678", "fullName" => "Jane Doe")
      end
    end

    it "exports l10n settings" do
      result = subject.to_agama(profile)
      expect(result["localization"]).to include(
        "language" => "en_US.UTF-8",
        "timezone" => "Atlantic/Canary",
        "keyboard" => "us"
      )
    end

    context "for valid AutoYaST profile" do
      let(:profile_name) { "cloned.xml" }

      it "generates JSON according to schema" do
        # sadly rubygem-json-schema cannot be used due to too old supported format
        if !system("which jsonschema")
          pending "can run only if python3-jsonschema is installed"
          break
        end

        result = subject.to_agama(profile)

        schema = File.expand_path(
          "../../../../rust/agama-lib/share/profile.schema.json",
          __dir__
        )

        result_path = Tempfile.new("agama-test.json")
        result_path.write(JSON.pretty_generate(result))
        result_path.close

        # filter out deprecation warning as check-jsonschema is not packaged for TW yet
        result = `jsonschema -i '#{result_path.path}' '#{schema}' 2>&1 | \
          grep -v 'DeprecationWarning' | \
          grep -v 'from jsonschema.cli import main'`
        expect(result).to eq ""
      end
    end
  end
end
