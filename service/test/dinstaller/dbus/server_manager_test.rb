# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "tmpdir"
require "dinstaller/dbus/server_manager"

describe DInstaller::DBus::ServerManager do
  subject do
    described_class.new(run_directory: tmpdir)
  end

  let(:tmpdir) { Dir.mktmpdir }

  before do
    allow(Process).to receive(:spawn).and_return(9999)
    allow(Process).to receive(:detach)
  end

  after do
    FileUtils.remove_entry(tmpdir)
  end

  describe "#find_or_start_server" do
    context "when the server is started" do
      before do
        allow(subject).to receive(:find_server).and_return(1000)
      end

      it "returns the PID of the running server" do
        expect(subject.find_or_start_server).to eq(1000)
      end
    end

    context "when the server is not started" do
      before do
        allow(subject).to receive(:find_server).and_return(nil)
      end

      it "starts and returns the PID of the new server" do
        expect(subject).to receive(:start_server).and_return(1001)
        expect(subject.find_or_start_server).to eq(1001)
      end
    end
  end

  describe "#start_server" do
    it "starts the dbus-daemon and returns the PID" do
      expect(Process).to receive(:spawn)
        .with(/dbus-daemon/, "--config-file", /dbus.conf/, any_args)
        .and_return(1000)
      expect(Process).to receive(:detach).with(1000)
      expect(subject.start_server).to eq(1000)
    end

    it "writes the address to a file in the /run directory" do
      subject.start_server
      address = File.read(File.join(tmpdir, "bus.address"))
      expect(address).to eq("unix:path=#{tmpdir}/bus")
    end
  end

  describe "#stop_server" do
    before do
      allow(subject).to receive(:find_server).and_return(pid)
    end

    context "when a D-Bus server is running" do
      let(:pid) { 1000 }

      it "stops the process" do
        expect(Process).to receive(:kill).with("KILL", pid)
        subject.stop_server
      end
    end

    context "when no D-Bus server is running" do
      let(:pid) { nil }

      it "does not try to stop the process" do
        expect(Process).to_not receive(:kill)
        subject.stop_server
      end
    end
  end

  describe "#find_server" do
    context "when a PID file exists" do
      let(:pid_file_content) { "1000" }

      before do
        File.write(File.join(tmpdir, "bus.pid"), pid_file_content)
      end

      context "and the process exists" do
        before do
          allow(Process).to receive(:getpgid).with(1000).and_return(1000)
        end

        it "returns the PID" do
          expect(subject.find_server).to eq(1000)
        end
      end

      context "but it does not contain a PID" do
        let(:pid_file_content) { "something" }

        it "returns nil" do
          expect(subject.find_server).to be_nil
        end
      end

      context "but the process does not exist" do
        before do
          allow(Process).to receive(:getpgid).and_raise(Errno::ESRCH)
        end

        it "returns nil" do
          expect(subject.find_server).to be_nil
        end
      end
    end

    context "when no PID file exists" do
      it "returns nil" do
        expect(subject.find_server).to be_nil
      end
    end
  end

  describe "#address" do
    it "returns the server address" do
      expect(subject.address).to eq("unix:path=#{tmpdir}/bus")
    end
  end
end
