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
Yast.import "AutoinstScripts"

# NOTE: every "location" string literal below is unfrozen (with the unary '+') since
# Y2Autoinstallation::Script#resolve_location mutates it in place via String#strip!, and
# (unlike the upstream file) this one has "frozen_string_literal: true" enabled.

describe Yast::AutoinstScripts do
  subject { Yast::AutoinstScripts }

  before do
    # Upstream's test_helper.rb stubs these globally ("temporary mock to avoid
    # interdependencies failures"); it is only needed here, by the "#Write" examples below
    # that end up reporting a (mocked, in this context meaningless) script execution
    # failure, which would otherwise try to open a real UI popup.
    allow(Yast::Report).to receive(:Warning)

    allow(Yast::Mode).to receive(:autoinst).and_return(true)
    allow(Yast::SCR).to receive(:Write)
    # re-init, to avoid leaking state between examples
    subject.main
    Yast::AutoinstConfig.main
  end

  describe "#GetModified" do
    it "returns false if the modified flag is not set" do
      expect(subject.GetModified).to eq(false)
    end

    it "returns true if the modified flag is set" do
      subject.SetModified
      expect(subject.GetModified).to eq(true)
    end
  end

  describe "#SetModified" do
    it "sets the modified flag" do
      expect { subject.SetModified }.to change { subject.GetModified }.from(false).to(true)
    end
  end

  describe "#Import" do
    shared_examples "resolve location" do
      # these examples expect "type" and "key" to be defined
      it "strips white spaces from the location" do
        data = Yast::ProfileHash.new(
          key => [
            { "location" => "https://test.com/script  \n \t   " },
            { "location" => "\n\t  https://test.com/script2" }
          ]
        )
        expected = [
          "https://test.com/script",
          "https://test.com/script2"
        ]

        subject.Import(data)
        expect(subject.public_send(type).map(&:location)).to eq(expected)
      end

      context "when the AutoYaST profile URL is not a 'relurl' schema" do
        before do
          Yast::AutoinstConfig.ParseCmdLine("https://example.com/profile.xml")
        end

        it "resolves 'relurl' locations using the AutoYaST profile URL" do
          data = Yast::ProfileHash.new(
            key => [
              { "location" => "https://test.com/script" },
              { "location" => "relurl://script2" }
            ]
          )
          expected = [
            "https://test.com/script",
            "https://example.com/script2"
          ]

          subject.Import(data)
          expect(subject.public_send(type).map(&:location)).to eq(expected)
        end
      end

      context "when the AutoYaST profile URL is a 'relurl' schema" do
        before do
          Yast::AutoinstConfig.ParseCmdLine("relurl://profile.xml")
          allow(Yast::SCR).to receive(:Read).with(path(".etc.install_inf.ayrelurl"))
            .and_return("https://example2.com/ay/profile.xml")
        end

        it "resolves 'relurl' locations using 'ayrelurl' from install.inf" do
          data = Yast::ProfileHash.new(
            key => [
              { "location" => "https://test.com/script" },
              { "location" => "relurl://script2" }
            ]
          )
          expected = ["https://test.com/script", "https://example2.com/ay/script2"]

          subject.Import(data)
          expect(subject.public_send(type).map(&:location)).to eq(expected)
        end
      end
    end

    context "with pre-scripts" do
      let(:type) { :pre_scripts }
      let(:key) { "pre-scripts" }

      include_examples "resolve location"
    end

    context "with init-scripts" do
      let(:type) { :init_scripts }
      let(:key) { "init-scripts" }

      include_examples "resolve location"
    end

    context "with post-scripts" do
      let(:type) { :post_scripts }
      let(:key) { "post-scripts" }

      include_examples "resolve location"
    end

    context "with chroot-scripts" do
      let(:type) { :chroot_scripts }
      let(:key) { "chroot-scripts" }

      include_examples "resolve location"
    end

    context "with postpartitioning-scripts" do
      let(:type) { :postpart_scripts }
      let(:key) { "postpartitioning-scripts" }

      include_examples "resolve location"
    end
  end

  describe "#Export" do
    it "returns a hash with the defined scripts" do
      data = Yast::ProfileHash.new(
        "pre-scripts" => [{ "location" => "http://test.com/new_script", "param-list" => [],
            "filename" => "script4", "source" => "", "interpreter" => "perl", "rerun" => false,
            "debug" => false, "feedback" => false, "feedback_type" => "", "notification" => "" }]
      )

      subject.Import(data)
      expect(subject.Export).to eq(data)
    end
  end

  describe "#AddEditScript" do
    context "when the given filename already exists" do
      it "edits the existing one" do
        data = Yast::ProfileHash.new(
          "pre-scripts"  => [{ "location" => "http://test.com/script", "filename" => "script1" }],
          "post-scripts" => [{ "location" => "http://test.com/script2", "filename" => "script2" },
                             { "location" => "http://test.com/script3", "filename" => "script3" }]
        )

        subject.Import(data)

        subject.AddEditScript("script2", "", "perl", "post-scripts", false, false, false, "",
          "http://test.com/new_script", "")

        expect(subject.scripts.size).to eq(3)
        new_script = subject.scripts.find { |s| s.filename == "script2" }
        expect(new_script.interpreter).to eq("perl")
        expect(new_script.source).to eq("")
        expect(new_script.location).to eq("http://test.com/new_script")
        expect(new_script).to be_a(Y2Autoinstallation::PostScript)
      end
    end

    context "when the given filename does not exist" do
      it "adds a new one to the merged list" do
        data = Yast::ProfileHash.new(
          "pre-scripts"  => [{ "location" => "http://test.com/script", "filename" => "script1" }],
          "post-scripts" => [{ "location" => "http://test.com/script2", "filename" => "script2" },
                             { "location" => "http://test.com/script3", "filename" => "script3" }]
        )

        subject.Import(data)

        subject.AddEditScript("script4", "", "perl", "post-scripts", false, false, false,
          "", "http://test.com/new_script", "")

        expect(subject.scripts.size).to eq(4)
        new_script = subject.scripts.find { |s| s.filename == "script4" }
        expect(new_script.interpreter).to eq("perl")
        expect(new_script.source).to eq("")
        expect(new_script.location).to eq("http://test.com/new_script")
        expect(new_script).to be_a(Y2Autoinstallation::PostScript)
      end
    end
  end

  describe "#deleteScript" do
    it "removes the script with the given filename from the merged list" do
      data = Yast::ProfileHash.new(
        "pre-scripts"  => [{ "location" => "http://test.com/script", "filename" => "script1" }],
        "post-scripts" => [{ "location" => "http://test.com/script2", "filename" => "script2" },
                           { "location" => "http://test.com/script3", "filename" => "script3" }]
      )

      subject.Import(data)

      expect { subject.deleteScript("script2") }
        .to change { subject.scripts.size }.from(3).to(2)
    end
  end

  describe "#typeString" do
    it "returns a string according to the given type" do
      expect(subject.typeString("pre-scripts")).to eq("Pre")
    end

    it "returns the localized 'Unknown' for an unknown type" do
      expect(subject.typeString("peklicko")).to eq("Unknown")
    end
  end

  describe "#Write" do
    before do
      # no real execution
      allow(Yast::SCR).to receive(:Execute)
    end

    it "returns true outside of auto installation and auto upgrade" do
      allow(Yast::Mode).to receive(:autoinst).and_return(false)
      allow(Yast::Mode).to receive(:autoupgrade).and_return(false)

      expect(subject.Write("pre-scripts", true)).to eq(true)
    end

    context "for pre-scripts" do
      it "downloads the script from its location if defined" do
        data = Yast::ProfileHash.new(
          "pre-scripts" => [{ "location" => "http://test.com/script", "filename" => "script1" }]
        )

        expect_any_instance_of(Yast::Transfer::FileFromUrl).to(
          receive(:get_file_from_url) do |_klass, map|
            expect(map[:scheme]).to eq("http")
            expect(map[:host]).to eq("test.com")
            expect(map[:urlpath]).to eq("/script")
            expect(map[:localfile]).to match(%r{pre-scripts/script1$})

            true
          end
        )

        subject.Import(data)
        subject.Write("pre-scripts", true)
      end

      it "creates the script file from its source if the location is not defined" do
        data = Yast::ProfileHash.new(
          "pre-scripts" => [{ "source"   => "echo krucifix > /home/dabel/body",
                              "filename" => "script1" }]
        )

        expect(Yast::SCR).to receive(:Write).with(path(".target.string"),
          %r{pre-scripts/script1$}, "echo krucifix > /home/dabel/body")

        subject.Import(data)
        subject.Write("pre-scripts", true)
      end

      context "when the script does not run" do
        let(:script) do
          Y2Autoinstallation::PreScript.new(
            "location" => "http://test.com/script", "rerun" => false
          )
        end

        before do
          allow(subject).to receive(:scripts).and_return([script])
          allow(script).to receive(:execute).and_return(nil)
        end

        it "does not report any problem" do
          expect(Yast::Report).to_not receive(:Warning)
          subject.Write("pre-scripts", false)
        end
      end
    end

    context "for postpartitioning-scripts" do
      it "downloads the script from its location if defined" do
        data = Yast::ProfileHash.new(
          "postpartitioning-scripts" => [{ "location" => "http://test.com/script",
                                           "filename" => "script1" }]
        )

        expect_any_instance_of(Yast::Transfer::FileFromUrl).to(
          receive(:get_file_from_url) do |_klass, map|
            expect(map[:scheme]).to eq("http")
            expect(map[:host]).to eq("test.com")
            expect(map[:urlpath]).to eq("/script")
            expect(map[:localfile]).to match(/script1$/)

            true
          end
        )

        subject.Import(data)
        subject.Write("postpartitioning-scripts", true)
      end

      it "creates the script file from its source if the location is not defined" do
        data = Yast::ProfileHash.new(
          "postpartitioning-scripts" => [{ "source"   => "echo krucifix > /home/dabel/body",
                                           "filename" => "script1" }]
        )

        expect(Yast::SCR).to receive(:Write).with(path(".target.string"),
          /script1$/, "echo krucifix > /home/dabel/body")

        subject.Import(data)
        subject.Write("postpartitioning-scripts", true)
      end
    end

    context "for init-scripts" do
      it "downloads the script from its location if defined" do
        data = Yast::ProfileHash.new(
          "init-scripts" => [{ "location" => "http://test.com/script", "filename" => "script1" }]
        )

        expect_any_instance_of(Yast::Transfer::FileFromUrl).to(
          receive(:get_file_from_url) do |_klass, map|
            expect(map[:scheme]).to eq("http")
            expect(map[:host]).to eq("test.com")
            expect(map[:urlpath]).to eq("/script")
            expect(map[:localfile]).to eq("/var/adm/autoinstall/init.d/script1")

            true
          end
        )

        subject.Import(data)
        subject.Write("init-scripts", true)
      end

      it "creates the script file from its source if the location is not defined" do
        data = Yast::ProfileHash.new(
          "init-scripts" => [{ "source"   => "echo krucifix > /home/dabel/body",
                               "filename" => "script1" }]
        )

        expect(Yast::SCR).to receive(:Write).with(path(".target.string"),
          "/var/adm/autoinstall/init.d/script1", "echo krucifix > /home/dabel/body")

        subject.Import(data)
        subject.Write("init-scripts", true)
      end
    end
  end
end
