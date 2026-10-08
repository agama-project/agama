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

Yast.import "Profile"

describe Yast::Profile do
  subject { Yast::Profile }

  def items_list(items)
    Yast::Profile.current["software"][items] || []
  end

  def patterns_list
    items_list("patterns")
  end

  def reboot_scripts
    Yast::Profile.current["scripts"]["init-scripts"].select do |s|
      s["filename"] == "zzz_reboot"
    end
  end

  describe "#softwareCompat" do
    before do
      Yast::Profile.current = profile
    end

    context "when the software patterns section is empty" do
      let(:profile) { Yast::ProfileHash.new("software" => { "patterns" => [] }) }

      it "adds the 'base' pattern" do
        Yast::Profile.softwareCompat
        expect(patterns_list).to include("base")
      end
    end

    context "when the software patterns section is missing" do
      let(:profile) { Yast::ProfileHash.new }

      it "adds the 'base' pattern" do
        Yast::Profile.softwareCompat
        expect(patterns_list).to include("base")
      end
    end
  end

  describe "#generalCompat" do
    before do
      Yast::Profile.current = profile
    end

    context "when a custom reboot script is not present" do
      let(:profile) { { "general" => { "mode" => { "final_reboot" => true } } } }

      it "adds a reboot script for the 'final_reboot' flag" do
        Yast::Profile.generalCompat
        expect(reboot_scripts).to_not be_empty
      end
    end

    # the first stage adds a custom script for the "final_reboot" flag,
    # ensure the second stage does not add it again (bsc#1188356)
    context "when a custom reboot script is present" do
      let(:profile) do
        { "general" => { "mode" => { "final_reboot" => true } },
          "scripts" => { "init-scripts" => [
            { "filename" => "zzz_reboot", "source" => "shutdown -r now" }
          ] } }
      end

      it "does not duplicate the reboot script" do
        Yast::Profile.generalCompat
        expect(reboot_scripts.size).to eq(1)
      end
    end
  end

  describe "#Import" do
    let(:profile) { Yast::ProfileHash.new }

    context "when the profile is given in the old format" do
      context "and the 'install' key is present" do
        let(:profile) { Yast::ProfileHash.new("install" => { "section1" => ["val1"] }) }

        it "moves the 'install' items to the root of the profile" do
          Yast::Profile.Import(profile)
          expect(Yast::Profile.current["section1"]).to eq(["val1"])
          expect(Yast::Profile.current["install"]).to be_nil
        end
      end

      context "and the 'configure' key is present" do
        let(:profile) { Yast::ProfileHash.new("configure" => { "section2" => ["val2"] }) }

        it "moves the 'configure' items to the root of the profile" do
          Yast::Profile.Import(profile)
          expect(Yast::Profile.current["section2"]).to eq(["val2"])
          expect(Yast::Profile.current["configure"]).to be_nil
        end
      end

      context "when both keys are present" do
        let(:profile) do
          Yast::ProfileHash.new(
            "configure" => { "section2" => ["val2"] },
            "install"   => { "section1" => ["val1"] }
          )
        end

        it "merges them into the root of the profile" do
          Yast::Profile.Import(profile)
          expect(Yast::Profile.current["section1"]).to eq(["val1"])
          expect(Yast::Profile.current["section2"]).to eq(["val2"])
          expect(Yast::Profile.current["install"]).to be_nil
          expect(Yast::Profile.current["configure"]).to be_nil
        end
      end

      context "when both keys are present and some section is duplicated" do
        let(:profile) do
          Yast::ProfileHash.new(
            "configure" => { "section1" => "val3", "section2" => ["val2"] },
            "install"   => { "section1" => ["val1"] }
          )
        end

        it "merges them giving precedence to the 'install' section" do
          Yast::Profile.Import(profile)
          expect(Yast::Profile.current["section1"]).to eq(["val1"])
          expect(Yast::Profile.current["section2"]).to eq(["val2"])
          expect(Yast::Profile.current["install"]).to be_nil
          expect(Yast::Profile.current["configure"]).to be_nil
        end
      end
    end

    it "sets general compatibility options" do
      expect(Yast::Profile).to receive(:generalCompat)
      Yast::Profile.Import(profile)
    end

    it "sets software compatibility options" do
      expect(Yast::Profile).to receive(:softwareCompat)
      Yast::Profile.Import(profile)
    end

    context "when the profile contains an aliased resource 'runlevel'" do
      context "and configuration for the resource is missing" do
        let(:profile) { { "runlevel" => { "dummy" => true } } }

        it "reuses the aliased configuration" do
          Yast::Profile.Import(profile)
          expect(Yast::Profile.current.keys).to_not include("old_custom")
          expect(Yast::Profile.current["services-manager"]).to eq("dummy" => true)
        end
      end

      context "and configuration for the resource is present" do
        let(:profile) do
          { "runlevel" => { "dummy" => true }, "services-manager" => { "dummy" => false } }
        end

        it "removes the aliased configuration" do
          Yast::Profile.Import(profile)
          expect(Yast::Profile.current.keys).to_not include("runlevel")
          expect(Yast::Profile.current["services-manager"]).to eq("dummy" => false)
        end
      end

      context "and no configuration is present" do
        let(:profile) { {} }

        it "does not set any configuration for the resource" do
          Yast::Profile.Import(profile)
          expect(Yast::Profile.current.keys).to_not include("runlevel")
          expect(Yast::Profile.current.keys).to_not include("services-manager")
        end
      end
    end
  end

  describe "#ReadXML" do
    let(:path) { File.join(FIXTURES_PATH, "yast2", "profile", xml_file) }

    before do
      subject.main
    end

    context "when the file is valid" do
      let(:xml_file) { "partitions.xml" }

      it "returns true" do
        expect(subject.ReadXML(path)).to eq(true)
      end

      it "imports the file content" do
        expect(subject).to receive(:Import).with(Hash)
        subject.ReadXML(path)
      end
    end

    context "when the file content is invalid" do
      let(:xml_file) { "invalid.xml" }

      before do
        allow(Yast2::Popup).to receive(:show)
      end

      it "returns false" do
        expect(subject.ReadXML(path)).to eq(false)
      end

      it "displays an error message" do
        expect(Yast2::Popup).to receive(:show)
        subject.ReadXML(path)
      end

      it "does not import the file content" do
        expect(subject).to_not receive(:Import)
        subject.ReadXML(path)
      end
    end

    context "when the content is encrypted" do
      let(:xml_file) { "profile.xml.asc" }

      before do
        # NOTE: stubbing ::UI::PasswordDialog#run directly (instead of the lower-level
        # Yast::UI.UserInput/QueryWidget/OpenDialog calls the *default* ui/password_dialog.rb
        # implementation relies on) makes this independent of whether some other part of the
        # test suite has already loaded agama/autoyast/report_patching.rb, which monkey-patches
        # ::UI::PasswordDialog to ask over HTTP instead (see lib/agama/autoyast/profile_fetcher.rb).
        allow_any_instance_of(UI::PasswordDialog).to receive(:run).and_return("nots3cr3t")
      end

      around do |example|
        FileUtils.cp(File.join(FIXTURES_PATH, "yast2", "profile", "minimal.xml.asc"), path)
        example.run
        FileUtils.rm(path)
      end

      it "decrypts and imports the file content" do
        expect(subject).to receive(:Import).with(Hash)
        subject.ReadXML(path)
      end

      context "during the first stage" do
        before do
          allow(Yast::Stage).to receive(:initial).and_return(true)
        end

        it "saves the unencrypted content" do
          subject.ReadXML(path)
          expect(File.read(path)).to_not include("BEGIN PGP MESSAGE")
        end
      end
    end
  end
end
