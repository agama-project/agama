# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "dinstaller/storage/manager"
require "dinstaller/storage/iscsi/manager"
require "dinstaller/config"
require "dinstaller/dbus/clients/questions"

describe DInstaller::Storage::Manager do
  subject(:storage) { described_class.new(config, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "d-installer.yaml")
  end
  let(:config) { DInstaller::Config.from_file(config_path) }

  before do
    allow(Y2Storage::StorageManager).to receive(:instance).and_return(y2storage_manager)
    allow(DInstaller::DBus::Clients::Questions).to receive(:new).and_return(questions_client)
    allow(DInstaller::DBus::Clients::Software).to receive(:new)
      .and_return(software)
    allow(Bootloader::FinishClient).to receive(:new)
      .and_return(bootloader_finish)
    allow(DInstaller::Security).to receive(:new).and_return(security)
  end

  let(:y2storage_manager) { instance_double(Y2Storage::StorageManager, probe: nil) }
  let(:questions_client) { instance_double(DInstaller::DBus::Clients::Questions) }
  let(:software) do
    instance_double(DInstaller::DBus::Clients::Software, selected_product: "ALP")
  end
  let(:bootloader_finish) { instance_double(Bootloader::FinishClient, write: nil) }
  let(:security) { instance_double(DInstaller::Security, probe: nil, write: nil) }

  describe "#probe" do
    before do
      allow(DInstaller::Storage::Proposal).to receive(:new).and_return(proposal)
      allow(DInstaller::Storage::ISCSI::Manager).to receive(:new).and_return(iscsi)
    end

    let(:proposal) do
      instance_double(DInstaller::Storage::Proposal, calculate: nil, available_devices: devices)
    end

    let(:devices) { [disk1, disk2] }

    let(:disk1) { instance_double(Y2Storage::Disk, name: "/dev/vda") }
    let(:disk2) { instance_double(Y2Storage::Disk, name: "/dev/vdb") }

    let(:iscsi) { DInstaller::Storage::ISCSI::Manager.new }

    it "probes the storage devices and calculates a proposal" do
      expect(config).to receive(:pick_product).with("ALP")
      expect(iscsi).to receive(:activate)
      expect(y2storage_manager).to receive(:activate) do |callbacks|
        expect(callbacks).to be_a(DInstaller::Storage::Callbacks::Activate)
      end
      expect(iscsi).to receive(:probe)
      expect(y2storage_manager).to receive(:probe)
      expect(proposal).to receive(:calculate)
      storage.probe
    end
  end

  describe "#install" do
    before do
      allow(y2storage_manager).to receive(:staging).and_return(proposed_devicegraph)

      allow(Yast::WFM).to receive(:CallFunction).with("inst_prepdisk", [])
      allow(Yast::WFM).to receive(:CallFunction).with("inst_bootloader", [])
      allow(Yast::PackagesProposal).to receive(:SetResolvables)
      allow(Bootloader::ProposalClient).to receive(:new)
        .and_return(bootloader_proposal)
    end

    let(:proposed_devicegraph) do
      instance_double(Y2Storage::Devicegraph, used_features: used_features)
    end

    let(:used_features) do
      instance_double(Y2Storage::StorageFeaturesList, pkg_list: ["btrfsprogs", "snapper"])
    end

    let(:bootloader_proposal) { instance_double(Bootloader::ProposalClient, make_proposal: nil) }

    it "adds storage software to install" do
      expect(Yast::PackagesProposal).to receive(:SetResolvables) do |_, _, packages|
        expect(packages).to contain_exactly("btrfsprogs", "snapper")
      end

      storage.install
    end

    it "runs the inst_prepdisk client" do
      expect(Yast::WFM).to receive(:CallFunction).with("inst_prepdisk", [])
      storage.install
    end
  end

  describe "#proposal" do
    it "returns an instance of the Storage::Proposal class" do
      expect(storage.proposal).to be_a(DInstaller::Storage::Proposal)
    end
  end

  describe "#finish" do
    it "installs the bootloader, sets up the snapshots, copy logs, and umounts the file systems" do
      expect(security).to receive(:write)
      expect(bootloader_finish).to receive(:write)
      expect(Yast::WFM).to receive(:CallFunction).with("snapshots_finish", ["Write"])
      expect(Yast::WFM).to receive(:CallFunction).with("copy_logs_finish", ["Write"])
      expect(Yast::WFM).to receive(:CallFunction).with("umount_finish", ["Write"])
      storage.finish
    end
  end

  describe "#validate" do
    let(:errors) { [double("error 1")] }
    let(:proposal) do
      instance_double(DInstaller::Storage::Proposal, validate: errors)
    end

    before do
      allow(DInstaller::Storage::Proposal).to receive(:new).and_return(proposal)
    end

    it "returns the proposal errors" do
      expect(storage.validate).to eq(errors)
    end
  end
end
