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

require_relative "../../../test_helper"
require "autoinstall/script"
require "tmpdir"

describe Y2Autoinstallation::Script do
  subject do
    described_class.new(
      "filename" => "test.sh",
      "source"   => "echo test",
      "debug"    => true
    )
  end

  describe "#to_hash" do
    it "returns hash" do
      expect(subject.to_hash).to eq(
        "filename" => "test.sh",
        "source"   => "echo test",
        "debug"    => true,
        "location" => ""
      )
    end
  end

  describe "#logs_dir" do
    it "returns string with path" do
      expect(subject.logs_dir).to be_a(String)
    end
  end

  describe "#script_name" do
    it "returns string" do
      expect(subject.logs_dir).to be_a(String)
    end

    it "returns filename if it is not empty" do
      script = described_class.new(
        "filename" => "test.sh",
        "source"   => "echo test",
        "debug"    => true
      )

      expect(script.script_name).to eq "test.sh"
    end

    it "returns filename from location if location is not empty" do
      script = described_class.new(
        "filename" => "",
        "location" => "ftp://neser-vr.suse.cz/scripts/remote.sh"
      )

      expect(script.script_name).to eq "remote.sh"
    end

    it "returns class type in other cases" do
      script = Y2Autoinstallation::PreScript.new({})

      expect(script.script_name).to eq script.class.type
    end
  end

  describe "#script_path" do
    it "returns string with path" do
      expect(subject.script_path).to be_a(String)
    end
  end

  describe "#create_script_file" do
    before do
      allow(Yast::SCR).to receive(:Execute)
      allow(Yast::SCR).to receive(:Write)
      allow(subject).to receive(:get_file_from_url)
    end

    it "ensure that script directory exists" do
      expect(Yast::SCR).to receive(:Execute)
        .with(path(".target.mkdir"), "/var/adm/autoinstall/scripts")

      subject.create_script_file
    end

    it "ensure that logs directory exists" do
      expect(Yast::SCR).to receive(:Execute)
        .with(path(".target.mkdir"), "/var/adm/autoinstall/logs")

      subject.create_script_file
    end

    it "downloads script if location is defined" do
      script = described_class.new(
        "filename" => "",
        "location" => "ftp://neser-vr.suse.cz/scripts/remote.sh"
      )

      expect(script).to receive(:get_file_from_url).with(
        scheme: "ftp", host: "neser-vr.suse.cz", urlpath: "scripts/remote.sh",
        localfile: "/var/adm/autoinstall/scripts/remote.sh",
        urltok: Yast::URL.Parse("ftp://neser-vr.suse.cz/scripts/remote.sh"),
        destdir: "/"
      )

      script.create_script_file
    end

    it "writes down source if defined" do
      script = described_class.new(
        "filename" => "test.sh",
        "source"   => "echo test"
      )

      expect(Yast::SCR).to receive(:Write).with(
        path(".target.string"),
        "/var/adm/autoinstall/scripts/test.sh",
        "echo test"
      )

      script.create_script_file
    end

    it "logs error otherwise" do
      script = described_class.new(
        "filename" => "test.sh"
      )

      expect(script.log).to receive(:error)

      script.create_script_file
    end
  end
end

describe Y2Autoinstallation::ScriptFeedback do
  describe "#initialize" do
    it "sets value to :no if feedback is false" do
      expect(described_class.new("feedback" => false).value).to eq :no
    end

    context "feedback is set to true" do
      it "sets value to :message if feedback_type is message" do
        expect(described_class.new("feedback" => true, "feedback_type" => "message").value).to(
          eq :message
        )
      end

      it "sets value to :warning if feedback_type is warning" do
        expect(described_class.new("feedback" => true, "feedback_type" => "warning").value).to(
          eq :warning
        )
      end

      it "sets value to :error if feedback_type is error" do
        expect(described_class.new("feedback" => true, "feedback_type" => "error").value).to(
          eq :error
        )
      end

      it "sets value to :popup if feedback_type is empty string" do
        expect(described_class.new("feedback" => true, "feedback_type" => "").value).to(
          eq :popup
        )
      end

      it "sets value to :popup if feedback_type is not defined" do
        expect(described_class.new("feedback" => true).value).to eq :popup
      end
    end
  end

  describe "#to_hash" do
    it "returns hash according to value" do
      feedback = described_class.new("feedback" => true, "feedback_type" => "warning")

      expect(feedback.to_hash).to eq("feedback" => true, "feedback_type" => "warning")
    end
  end
end

describe Y2Autoinstallation::ExecutedScript do
  subject do
    described_class.new(
      "filename"    => "test.sh",
      "source"      => "echo test",
      "debug"       => true,
      "feedback"    => false,
      "interpreter" => "shell",
      "rerun"       => true
    )
  end

  describe "log_path" do
    it "returns string with full log path" do
      expect(subject.log_path).to be_a String
    end
  end

  describe "#execute" do
    context "script already run and rerun flag is false" do
      it "does nothing" do
        script = described_class.new(
          "filename"    => "test.sh",
          "source"      => "echo test",
          "debug"       => true,
          "feedback"    => false,
          "interpreter" => "shell",
          "rerun"       => false
        )

        allow(script).to receive(:already_run?).and_return(true)

        expect(Yast::SCR).to_not receive(:Execute)

        script.execute
      end
    end

    context "otherwise" do
      before do
        allow(Yast::SCR).to receive(:Execute)
        allow(subject).to receive(:already_run?).and_return(false)
      end

      it "runs script" do
        expect(Yast::SCR).to receive(:Execute).with(
          path(".target.bash"),
          " /bin/sh -x /var/adm/autoinstall/scripts/test.sh  " \
          "&> /var/adm/autoinstall/logs/test.sh.log"
        )

        subject.execute
      end

      context "when env variables are given" do
        it "runs script" do
          expect(Yast::SCR).to receive(:Execute).with(
            path(".target.bash"),
            "LOGFILE=/var/log/my\\ script.log /bin/sh -x /var/adm/autoinstall/scripts/test.sh  " \
            "&> /var/adm/autoinstall/logs/test.sh.log"
          )

          subject.execute(LOGFILE: "/var/log/my script.log")
        end
      end

      it "creates flag file that script already run" do
        expect(Yast::SCR).to receive(:Execute).with(
          path(".target.bash"),
          "/bin/touch /var/adm/autoinstall/scripts/test.sh-run"
        )

        subject.execute
      end

      it "returns false if script failed" do
        allow(Yast::SCR).to receive(:Execute).and_return(1)

        expect(subject.execute).to eq false
      end
    end
  end
end

describe Y2Autoinstallation::PreScript do
  subject { described_class.new("filename" => "test.sh") }

  describe "#logs_dir" do
    it "returns path to logs in temporary directory" do
      allow(Yast::AutoinstConfig).to receive(:tmpDir).and_return("/tmp")

      expect(subject.logs_dir).to eq "/tmp/pre-scripts/logs"
    end
  end

  describe "#script_path" do
    it "returns path to script in temporary directory" do
      allow(Yast::AutoinstConfig).to receive(:tmpDir).and_return("/tmp")

      expect(subject.script_path).to eq "/tmp/pre-scripts/test.sh"
    end
  end

  describe ".type" do
    it "returns \"pre-scripts\"" do
      expect(described_class.type).to eq "pre-scripts"
    end
  end
end

describe Y2Autoinstallation::PostScript do
  describe ".type" do
    it "returns \"post-scripts\"" do
      expect(described_class.type).to eq "post-scripts"
    end
  end
end

describe Y2Autoinstallation::ChrootScript do
  describe ".type" do
    it "returns \"chroot-scripts\"" do
      expect(described_class.type).to eq "chroot-scripts"
    end
  end

  context "chrooted is set to false" do
    subject { described_class.new("filename" => "test.sh", "chrooted" => false) }

    before do
      allow(Yast::AutoinstConfig).to receive(:destdir).and_return("/mnt")
    end

    describe "#logs_dir" do
      it "returns logs_dir in destdir" do
        expect(subject.logs_dir).to eq "/mnt/var/adm/autoinstall/logs"
      end
    end

    describe "#script_path" do
      it "returns script_path in destdir" do
        expect(subject.script_path).to eq "/mnt/var/adm/autoinstall/scripts/test.sh"
      end
    end
  end
end

describe Y2Autoinstallation::PostPartitioningScript do
  subject { described_class.new("filename" => "test.sh") }

  before do
    allow(Yast::AutoinstConfig).to receive(:destdir).and_return("/mnt")
  end

  describe ".type" do
    it "returns \"postpartitioning-scripts\"" do
      expect(described_class.type).to eq "postpartitioning-scripts"
    end
  end

  describe "#logs_dir" do
    it "returns logs_dir in destdir" do
      expect(subject.logs_dir).to eq "/mnt/var/adm/autoinstall/logs"
    end
  end

  describe "#script_path" do
    it "returns script_path in destdir" do
      expect(subject.script_path).to eq "/mnt/var/adm/autoinstall/scripts/test.sh"
    end
  end
end

describe Y2Autoinstallation::InitScript do
  subject { described_class.new("filename" => "test.sh") }

  describe ".type" do
    it "returns \"init-scripts\"" do
      expect(described_class.type).to eq "init-scripts"
    end
  end

  describe "#script_path" do
    it "returns script_path in init scripts dir" do
      expect(subject.script_path).to eq "/var/adm/autoinstall/init.d/test.sh"
    end
  end

  describe "#localfile" do
    before do
      allow(Yast::AutoinstConfig).to receive(:destdir).and_return("/mnt")
    end

    it "returns the path in the target system" do
      expect(subject.localfile).to eq "/mnt/var/adm/autoinstall/init.d/test.sh"
    end
  end
end

describe Y2Autoinstallation::AskScript do
  subject(:script) do
    described_class.new(
      "source"   => "echo -n 'test'",
      "filename" => "test.sh"
    )
  end

  describe "#execute" do
    let(:tmp_dir) { Dir.mktmpdir }

    before do
      allow(Yast::AutoinstConfig).to receive(:tmpDir).and_return(tmp_dir)
    end

    after do
      FileUtils.rm_rf(tmp_dir)
    end

    describe "#logs_dir" do
      it "returns path to logs in temporary directory" do
        expect(subject.logs_dir).to eq(File.join(tmp_dir, "ask-scripts", "logs"))
      end
    end

    describe "#script_path" do
      it "returns path to script in temporary directory" do
        expect(subject.script_path).to eq(File.join(tmp_dir, "ask-scripts", "test.sh"))
      end
    end
  end
end

describe Y2Autoinstallation::AskDefaultValueScript do
  subject(:script) do
    described_class.new(
      "source"   => "echo -n 'test'",
      "filename" => "test.sh"
    )
  end

  describe "#execute" do
    let(:tmp_dir) { Dir.mktmpdir }

    before do
      allow(Yast::AutoinstConfig).to receive(:tmpDir).and_return(tmp_dir)
    end

    after do
      FileUtils.rm_rf(tmp_dir)
    end

    describe "#script_path" do
      it "returns path to script in temporary directory" do
        expect(subject.script_path).to eq(
          File.join(tmp_dir, "ask-default-value-scripts", "test.sh")
        )
      end
    end

    describe "#execute" do
      context "when it runs successfully" do
        it "returns true" do
          script.create_script_file
          expect(script.execute).to eq(true)
        end
      end

      context "when it failed" do
        subject(:script) do
          described_class.new(
            "source"   => "exit 1",
            "filename" => "test.sh"
          )
        end

        it "returns false" do
          script.create_script_file
          expect(script.execute).to eq(false)
        end
      end
    end

    describe "#stdout" do
      context "when the script has not been executed" do
        it "returns nil" do
          expect(script.stdout).to be_nil
        end
      end

      context "when the script has been successfully executed" do
        before do
          script.create_script_file
          script.execute
        end

        it "returns nil" do
          expect(script.stdout).to eq("test")
        end
      end
    end
  end
end
