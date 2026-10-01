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

Yast.import "AutoinstConfig"

describe Yast::AutoinstConfig do
  subject { Yast::AutoinstConfig }

  describe "#update_profile_location" do
    context "when the profile location is not defined" do
      it "returns a 'floppy' URL pointing to the default profile name" do
        expect(subject.update_profile_location("")).to match(%r{floppy:/+.*xml})
      end
    end

    context "when the profile location is 'default'" do
      it "returns a 'file' URL pointing to the default profile name" do
        expect(subject.update_profile_location("default")).to match(%r{file:/+.*xml})
      end
    end

    context "when the profile location is 'usb'" do
      it "returns a 'usb' URL pointing to the default profile name" do
        expect(subject.update_profile_location("usb")).to match(%r{usb:/+.*xml})
      end
    end

    context "when the profile location is anything else" do
      it "returns it unchanged" do
        expect(subject.update_profile_location("https://example.com/profile.xml"))
          .to eq("https://example.com/profile.xml")
      end
    end
  end

  describe "#ParseCmdLine" do
    context "when the profile URL is invalid" do
      let(:autoyast_profile_url) { "//file:8080/path/auto-installation.xml" }

      it "reports an error and returns false" do
        expect(Yast::Report).to receive(:Error).with(/Invalid.*/)
        expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(false)
      end
    end

    context "when the AutoYaST profile URL is valid" do
      let(:autoyast_profile_url) { "https://moo:woo@192.168.0.1:8080/path/auto-installation.xml" }

      it "parses the given profile location and fills in the internal structures" do
        expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(true)

        expect(subject.scheme).to eq("https")
        expect(subject.host).to eq("192.168.0.1")
        expect(subject.filepath).to eq("/path/auto-installation.xml")
        expect(subject.port).to eq("8080")
        expect(subject.user).to eq("moo")
        expect(subject.pass).to eq("woo")
      end
    end

    context "when a 'relurl' is given" do
      let(:autoyast_profile_url) { "relurl://auto-installation.xml" }

      it "sets host and filename correctly" do
        expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(true)
        expect(subject.host).to eq("")
        expect(subject.scheme).to eq("relurl")
        expect(subject.filepath).to eq("auto-installation.xml")
      end
    end

    context "when a 'relurl' with a sub-path is given" do
      let(:autoyast_profile_url) { "relurl://sub_path/auto-installation.xml" }

      it "sets host and filename correctly" do
        expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(true)
        expect(subject.host).to eq("")
        expect(subject.scheme).to eq("relurl")
        expect(subject.filepath).to eq("sub_path/auto-installation.xml")
      end
    end

    context "when 'file://' is given" do
      context "and no sub-path is defined" do
        let(:autoyast_profile_url) { "file://auto-installation.xml" }

        it "sets host and filename correctly" do
          expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(true)
          expect(subject.host).to eq("")
          expect(subject.scheme).to eq("file")
          expect(subject.filepath).to eq("auto-installation.xml")
        end
      end

      context "and a sub-path is defined" do
        let(:autoyast_profile_url) { "file://sub-path/auto-installation.xml" }

        it "sets host and filename correctly" do
          expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(true)
          expect(subject.host).to eq("")
          expect(subject.scheme).to eq("file")
          expect(subject.filepath).to eq("sub-path/auto-installation.xml")
        end
      end
    end

    context "when 'file:///' (old format) is given" do
      context "and no sub-path is defined" do
        let(:autoyast_profile_url) { "file:///auto-installation.xml" }

        it "sets host and filename correctly" do
          expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(true)
          expect(subject.host).to eq("")
          expect(subject.scheme).to eq("file")
          expect(subject.filepath).to eq("/auto-installation.xml")
        end
      end

      context "and a sub-path is defined" do
        let(:autoyast_profile_url) { "file:///sub-path/auto-installation.xml" }

        it "sets host and filename correctly" do
          expect(subject.ParseCmdLine(autoyast_profile_url)).to eq(true)
          expect(subject.host).to eq("")
          expect(subject.scheme).to eq("file")
          expect(subject.filepath).to eq("/sub-path/auto-installation.xml")
        end
      end
    end
  end

  describe "#profile_path" do
    it "returns '<profile_dir>/autoinst.xml'" do
      expect(subject.profile_path).to eq("/tmp/profile/autoinst.xml")
    end
  end

  describe "#profile_backup_path" do
    it "returns '<profile_dir>/pre-autoinst.xml'" do
      expect(subject.profile_backup_path).to eq("/tmp/profile/pre-autoinst.xml")
    end
  end
end
