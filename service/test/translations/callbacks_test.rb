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

# Translated strings (textdomain "installation") of Yast::Transfer::FileFromUrl that end in the text
# of a question created by the Agama code.
#
# The path is: Agama::AutoYaST::ProfileFetcher#fetch (agama-autoyast command) ->
# Yast::ProfileLocation.Process -> Yast::Transfer::FileFromUrl#get_file_from_url (sets @GET_error)
# -> Yast::Report.Error -> Yast2::Popup.show (patched by agama/autoyast/report_patching) ->
# Agama::Question#text sent through Agama::HTTP::Clients::Questions#ask.
#
# See /tmp/tr_areas/report_4_callbacks_misc.md.

require_relative "../test_helper"
require "agama/http/clients/questions"
require "agama/autoyast/profile_fetcher"
require "tmpdir"
require "autoinstall/xml_checks"
require "y2storage"

Yast.import "ProfileLocation"
Yast.import "Installation"

describe "Translated texts of the AutoYaST profile fetching questions" do
  let(:profile_error) { "An error occurred while fetching the profile:\n" }

  let(:tmpdir) { Dir.mktmpdir }

  let(:questions_client) { instance_double(Agama::HTTP::Clients::Questions) }

  # Questions created by the code
  let(:questions) { [] }

  let(:execute_object) { Yast::Execute.new }

  # Temporary mount point used by Yast::Transfer::FileFromUrl
  let(:mount_point) { File.join(tmpdir, "tmp_mount") }

  before do
    # the modules from the yast2-transfer package are not available everywhere
    stub_const("Yast::FTP", double("FTP", Get: { "code" => 550 }))
    stub_const("Yast::HTTP", double("HTTP", Get: { "code" => 404 }, easySSL: nil))
    stub_const("Yast::TFTP", double("TFTP", Get: false))
    allow(Yast).to receive(:import).and_call_original

    stub_const("Y2Autoinstallation::XmlChecks::ERRORS_PATH", File.join(tmpdir, "errors"))
    allow(Yast::Installation).to receive(:sourcedir).and_return(File.join(tmpdir, "mount"))
    allow(Yast::Installation).to receive(:boot).and_return("")
    allow(Yast::InstURL).to receive(:installInf2Url).and_return("")
    allow(Yast::AutoinstConfig).to receive(:scripts_dir).and_return(File.join(tmpdir, "scripts"))
    allow(Yast::AutoinstConfig).to receive(:profile_dir).and_return(File.join(tmpdir, "profile"))
    allow(Yast::AutoinstConfig).to receive(:xml_tmpfile)
      .and_return(File.join(tmpdir, "autoinst.xml"))
    allow(Yast::AutoinstConfig).to receive(:modified_profile)
      .and_return(File.join(tmpdir, "profile", "modified.xml"))

    # no real SCR, WFM or external commands
    allow(Yast::WFM).to receive(:Read).with(path(".local.tmpdir"), []).and_return(tmpdir)
    allow(Yast::WFM).to receive(:SCRGetDefault).and_return(333)
    allow(Yast::WFM).to receive(:SCRGetName).with(333).and_return("chroot=/:scr")
    allow(Yast::WFM).to receive(:Execute).with(path(".local.mkdir"), anything)
    allow(Yast::WFM).to receive(:Execute).with(path(".local.umount"), anything)
    allow(Yast::SCR).to receive(:Read).and_return(-1)
    allow(Yast::SCR).to receive(:Read).with(path(".target.dir"), anything).and_return(nil)
    allow(Yast::SCR).to receive(:Execute).and_return(false)
    allow(Yast::SCR).to receive(:Execute).with(path(".target.bash_output"), anything)
      .and_return("exit" => 0, "stdout" => "", "stderr" => "")
    allow(Yast::SCR).to receive(:Execute).with(path(".target.umount"), anything)
    allow(Yast::Execute).to receive(:new).and_return(execute_object)
    allow(Yast::Execute).to receive(:locally!).and_return(execute_object)
    allow(execute_object).to receive(:stdout).and_return("")
    allow(Yast::Builtins).to receive(:sleep)

    allow(Agama::HTTP::Clients::Questions).to receive(:new).and_return(questions_client)
    allow(questions_client).to receive(:ask) { |question| questions << question }
  end

  after do
    FileUtils.remove_entry(tmpdir)
  end

  # Runs the profile fetcher with the given URL
  def fetch(url)
    expect(Agama::AutoYaST::ProfileFetcher.new(url).fetch).to be_nil
  end

  # Text of the only question created by the code
  def question_text
    expect(questions.size).to eq(1)
    expect(questions.first.qclass).to eq("autoyastPopup")
    questions.first.text
  end

  def mount_fails(source, mount_dir)
    allow(Yast::SCR).to receive(:Execute)
      .with(path(".target.mount"), [source, mount_dir], anything).and_return(false)
  end

  def mount_works(source, mount_dir)
    allow(Yast::SCR).to receive(:Execute)
      .with(path(".target.mount"), [source, mount_dir], anything).and_return(true)
  end

  def copy_fails
    allow(Yast::WFM).to receive(:Execute).with(path(".local.bash"), anything).and_return(1)
  end

  describe "Yast::Transfer::FileFromUrl#get_file_from_url" do
    it "returns: Cannot find URL '%1' via protocol HTTP(S). Server returned code %2." do
      fetch("http://example.org/profile.xml")

      expect(question_text).to eq(
        profile_error +
        "Cannot find URL 'http://example.org/profile.xml' via protocol HTTP(S). " \
        "Server returned code 404."
      )
    end

    it "returns: Cannot find URL '%1' via protocol FTP. Server returned code %2." do
      fetch("ftp://example.org/profile.xml")

      expect(question_text).to eq(
        profile_error +
        "Cannot find URL 'ftp://example.org/profile.xml' via protocol FTP. " \
        "Server returned code 550."
      )
    end

    it "returns: Cannot find URL '%1' via protocol TFTP." do
      fetch("tftp://example.org/profile.xml")

      expect(question_text).to eq(
        profile_error + "Cannot find URL 'example.org:/profile.xml' via protocol TFTP."
      )
    end

    it "returns: Unknown protocol %1." do
      fetch("foo://example.org/profile.xml")

      expect(question_text).to eq(profile_error + "Unknown protocol foo.")
    end

    it "returns: URLs starting with 'floppy:/' are not longer supported" do
      fetch("floppy:///profile.xml")

      expect(question_text).to eq(
        profile_error + "URLs starting with 'floppy:/' are not longer supported"
      )
    end

    context "when the scheme is 'file' and the file does not exist" do
      before { fetch("file:///nonexistent/profile.xml") }

      it "returns: Reading file on %1/%2 failed.\n" do
        expect(question_text).to include(
          "Reading file on #{tmpdir}/mount//nonexistent/profile.xml failed.\n"
        )
      end

      it "returns: Reading file on %1 failed.\n" do
        expect(question_text).to include("Reading file on /nonexistent/profile.xml failed.\n")
      end

      it "returns: Reading a file on CD failed. Path: %1/%2." do
        expect(question_text).to end_with(
          "Reading a file on CD failed. Path: #{mount_point}//nonexistent/profile.xml."
        )
      end
    end

    context "when the profile is read from a CD and the mount fails" do
      before do
        allow(Yast::Installation).to receive(:boot).and_return("cd")
        allow(Yast::Installation).to receive(:mountlog).and_return("/dev/null")
        allow(Yast::InstURL).to receive(:installInf2Url).and_return("cd:/?devices=/dev/sr0")
        allow(File).to receive(:read).and_call_original
        allow(File).to receive(:read).with("/proc/mounts").and_return("")
        allow(Yast::WFM).to receive(:Execute).with(path(".local.mount"), anything)
          .and_return(false)
      end

      it "returns: Mounting %1 failed. (CD)" do
        fetch("file:///nonexistent/profile.xml")

        expect(question_text).to include("Mounting /dev/sr0 failed.")
      end
    end

    context "when the scheme is 'nfs'" do
      it "returns: Mounting %1 failed. (NFS)" do
        mount_fails("example.org:/export/", mount_point)
        fetch("nfs://example.org/export/profile.xml")

        expect(question_text).to eq(profile_error + "Mounting example.org:/export/ failed.")
      end

      it "returns: Remote file %1 cannot be retrieved (NFS)" do
        mount_works("example.org:/export/", mount_point)
        copy_fails
        fetch("nfs://example.org/export/profile.xml")

        expect(question_text).to eq(
          profile_error + "Remote file #{mount_point}/profile.xml cannot be retrieved"
        )
      end
    end

    context "when the scheme is 'cifs'" do
      it "returns: Mounting %1 failed. (CIFS)" do
        mount_fails("//example.org/share/", mount_point)
        fetch("cifs://example.org/share/profile.xml")

        expect(question_text).to eq(profile_error + "Mounting //example.org/share/ failed.")
      end

      it "returns: Remote file %1 cannot be retrieved (CIFS)" do
        mount_works("//example.org/share/", mount_point)
        copy_fails
        fetch("cifs://example.org/share/profile.xml")

        expect(question_text).to eq(
          profile_error + "Remote file #{mount_point}/profile.xml cannot be retrieved"
        )
      end
    end

    context "when the scheme is 'device'" do
      it "returns: %1 is not mounted and mount failed" do
        mount_fails("/dev/sda1", mount_point)
        fetch("device://sda1/profile.xml")

        expect(question_text).to eq(profile_error + "/dev/sda1 is not mounted and mount failed")
      end

      it "returns: File %1 cannot be found" do
        mount_works("/dev/sda1", mount_point)
        copy_fails
        fetch("device://sda1/profile.xml")

        expect(question_text).to eq(
          profile_error + "File #{mount_point}/profile.xml cannot be found"
        )
      end
    end
  end
end
