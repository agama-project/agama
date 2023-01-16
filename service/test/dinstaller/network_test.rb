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
require "dinstaller/network"
require "dinstaller/progress"

describe DInstaller::Network do
  subject(:network) { described_class.new(logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:proposal) do
    instance_double(Y2Network::ProposalSettings,
      apply_defaults: nil, refresh_packages: nil, enable_network_manager!: true)
  end

  describe "#probe" do
    before do
      allow(Yast::Lan).to receive(:read_config)
      allow(Y2Network::ProposalSettings).to receive(:instance).and_return(proposal)
    end

    it "reads the network configuration" do
      expect(Yast::Lan).to receive(:read_config)
      network.probe
    end

    it "apply the defaults" do
      expect(proposal).to receive(:apply_defaults)
      network.probe
    end

    it "forces a selection of NetworkManager as the backend to be used" do
      expect(proposal).to receive(:enable_network_manager!)
      network.probe
    end
  end

  describe "#install" do
    let(:rootdir) { Dir.mktmpdir }
    let(:etcdir) do
      File.join(rootdir, "etc", "NetworkManager", "system-connections")
    end
    let(:targetdir) { File.join(rootdir, "mnt") }

    before do
      allow(Yast::Installation).to receive(:destdir).and_return(targetdir)
      stub_const("DInstaller::Network::ETC_NM_DIR", etcdir)
    end

    after do
      FileUtils.remove_entry(rootdir)
    end

    context "when NetworkManager configuration files are present" do
      before do
        FileUtils.mkdir_p(File.join(etcdir, "system-connections"))
        FileUtils.touch(File.join(etcdir, "system-connections", "wired.nmconnection"))
      end

      it "copies the configuration files" do
        network.install
        expect(File).to exist(
          File.join(targetdir, etcdir, "system-connections", "wired.nmconnection")
        )
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
  end
end
