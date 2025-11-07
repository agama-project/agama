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

require_relative "../test_helper"
require "tmpdir"
require "agama/network"

describe Agama::Network do
  subject(:network) { described_class.new(logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:targetdir) { File.join(rootdir, "mnt") }
  let(:fixtures) { File.join(FIXTURES_PATH, "root_dir") }
  let(:hostname_path) { File.join(fixtures, "etc", "hostname") }
  let(:agama_dir) { File.join(rootdir, "run", "agama") }
  let(:not_copy_network) { File.join(agama_dir, "not_copy_network") }

  before do
    allow(Yast::Installation).to receive(:destdir).and_return(targetdir)
    stub_const("Agama::Network::HOSTNAME", hostname_path)
    stub_const("Agama::Network::RUN_NM_DIR", File.join(rootdir, "run", "NetworkManager"))
    stub_const("Agama::Network::AGAMA_SYSTEMD_LINK",
      File.join(rootdir, Agama::Network::AGAMA_SYSTEMD_LINK))
    stub_const("Agama::Network::NOT_COPY_NETWORK", not_copy_network)
    FileUtils.mkdir_p(agama_dir)
  end

  after do
    FileUtils.remove_entry(rootdir)
  end

  describe "#install" do
    let(:rootdir) { Dir.mktmpdir }

    let(:etcdir) do
      File.join(rootdir, "etc", "NetworkManager", "system-connections")
    end

    let(:service) { instance_double(Yast2::Systemd::Service, enable: nil) }

    before do
      allow(Yast2::Systemd::Service).to receive(:find).with("NetworkManager").and_return(service)
      stub_const("Agama::Network::ETC_NM_DIR", etcdir)
    end

    context "when there is some Agama systemd network link file" do
      before do
        FileUtils.cp_r(Dir["#{fixtures}/*"], rootdir)
      end

      it "copies the files to /etc/systemd/network" do
        network.install
        expect(File).to exist(
          File.join(targetdir, "etc", "systemd", "network", "10-agama-ifname-bootdev.link")
        )
      end
    end

    context "when NetworkManager configuration files are present" do
      before do
        FileUtils.mkdir_p(File.join(etcdir, "system-connections"))
        FileUtils.touch(File.join(etcdir, "system-connections", "wired.nmconnection"))
      end

      context "and the /run/agama/not_copy_network file does not exist" do
        it "copies the configuration files" do
          network.install
          expect(File).to exist(
            File.join(targetdir, etcdir, "system-connections", "wired.nmconnection")
          )
        end
      end

      context "and the /run/agama/not_copy_network file exists" do
        around do |block|
          FileUtils.mkdir_p(agama_dir)
          FileUtils.touch(not_copy_network)
          block.call
          FileUtils.rm_f(not_copy_network)
        end

        it "does not try to copy any file" do
          expect(FileUtils).to_not receive(:cp_r)
          network.install
        end
      end
    end

    context "when NetworkManager configuration files are not available" do
      it "does not try to copy any file" do
        expect(FileUtils).to_not receive(:cp_r)
        network.install
      end
    end

    context "when NetworkManager connections are not defined" do
      before do
        FileUtils.mkdir_p(etcdir)
      end

      it "does not try to copy any file" do
        network.install
        expect(Dir).to_not exist(
          File.join(targetdir, etcdir, "system-connections")
        )
      end
    end

    context "when an static hostname is present" do
      let(:test_path) { File.join(fixtures, "etc", "hostname.test") }

      around do |block|
        FileUtils.mv test_path, hostname_path
        block.call
        FileUtils.mv hostname_path, test_path
      end

      it "copies it to the target system" do
        network.install
        expect(File.exist?(File.join(targetdir, Agama::Network::HOSTNAME))).to eql(true)
      end
    end

    it "enables the NetworkManager service" do
      expect(service).to receive(:enable)
      network.install
    end

    context "when the NetworkManager service is not found" do
      let(:service) { nil }

      it "logs an error" do
        expect(logger).to receive(:error).with("NetworkManager service was not found")
        network.install
      end
    end
  end

  describe "#link_resolv" do
    let(:rootdir) { Dir.mktmpdir }

    let(:resolv_fixture) { File.join(FIXTURES_PATH, "etc", "resolv.conf") }
    let(:resolv_flag) { File.join(rootdir, "run", "agama", "manage_resolv") }
    let(:resolv) { File.join(targetdir, "etc", "resolv.conf") }

    before do
      stub_const("Agama::Network::RESOLV_FLAG", resolv_flag)
      FileUtils.mkdir_p targetdir
      FileUtils.cp_r(Dir["#{fixtures}/*"], rootdir)
      FileUtils.cp_r(Dir["#{fixtures}/*"], targetdir)
    end

    context "when the /etc/resolv.conf exists in the installation destdir" do
      before do
        FileUtils.mkdir_p File.join(targetdir, "etc")
        FileUtils.touch File.join(targetdir, "etc", "resolv.conf")
      end

      it "does nothing" do
        expect(FileUtils).to_not receive(:ln_s)
        network.link_resolv
      end
    end

    context "when there is no /etc/resolv.conf in the installation destdir" do
      it "symlinks it to /run/NetworkManager/resolv.conf" do
        network.link_resolv
        expect(File.exist?(resolv)).to eql(true)
        expect(File.symlink?(resolv)).to eql(true)
      end

      it "creates a flag indicating that the resolv.conf is managed by Agama" do
        network.link_resolv
        expect(File.exist?(resolv_flag)).to eql(true)
      end
    end
  end

  describe "#unlink_resolv" do
    let(:rootdir) { Dir.mktmpdir }

    let(:fixtures) { File.join(FIXTURES_PATH, "root_dir") }
    let(:resolv_fixture) { File.join(FIXTURES_PATH, "etc", "resolv.conf") }
    let(:resolv_flag) { File.join(rootdir, "run", "agama", "manage_resolv") }
    let(:resolv) { File.join(targetdir, "etc", "resolv.conf") }

    before do
      stub_const("Agama::Network::RESOLV_FLAG", resolv_flag)
      stub_const("Agama::Network::RUN_NM_DIR", File.join(rootdir, "run", "NetworkManager"))
      FileUtils.mkdir_p targetdir
      FileUtils.cp_r(Dir["#{fixtures}/*"], rootdir)
      FileUtils.cp_r(Dir["#{fixtures}/*"], targetdir)
    end

    context "when the /etc/resolv.conf was marked as managed by Agama" do
      it "removes the /etc/resolv.con symlink from the installation destdir" do
        network.link_resolv
        expect(File.exist?(resolv_flag)).to eql(true)
        expect(File.symlink?(resolv)).to eql(true)
        network.unlink_resolv
        expect(File.exist?(resolv)).to eql(false)
        expect(File.exist?(resolv_flag)).to eql(false)
      end
    end
  end
end
