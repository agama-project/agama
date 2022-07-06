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
require "dinstaller/manager"
require "dinstaller/config"

describe DInstaller::Manager do
  subject { described_class.new(config, logger) }

  let(:config) { DInstaller::Config.new }
  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:software) do
    instance_double(
      DInstaller::DBus::Clients::Software,
      probe: nil, install: nil, propose: nil, finish: nil, on_product_selected: nil
    )
  end
  let(:users) { instance_double(DInstaller::DBus::Clients::Users, write: nil) }
  let(:language) { instance_double(DInstaller::Language, probe: nil, install: nil) }
  let(:network) { instance_double(DInstaller::Network, probe: nil, install: nil) }
  let(:storage) do
    instance_double(DInstaller::Storage::Manager, probe: nil, install: nil, finish: nil)
  end
  let(:security) { instance_double(DInstaller::Security, probe: nil, write: nil) }
  let(:questions_manager) { instance_double(DInstaller::QuestionsManager) }

  before do
    allow(DInstaller::Language).to receive(:new).and_return(language)
    allow(DInstaller::Network).to receive(:new).and_return(network)
    allow(DInstaller::Security).to receive(:new).and_return(security)
    allow(DInstaller::DBus::Clients::Software).to receive(:new).and_return(software)
    allow(DInstaller::DBus::Clients::Users).to receive(:new).and_return(users)
    allow(DInstaller::Storage::Manager).to receive(:new).and_return(storage)
    allow(DInstaller::QuestionsManager).to receive(:new).and_return(questions_manager)
  end

  describe "#setup" do
    it "probes languages" do
      expect(language).to receive(:probe)
      expect(software).to receive(:on_product_selected)
      subject.setup
    end
  end
  describe "#probe" do
    before do
      allow(software).to receive(:status).and_return(software_status)
      allow(users).to receive(:status).and_return(users_status)
    end

    let(:software_status) { DInstaller::Status::Error.new }
    let(:users_status) { DInstaller::Status::Error.new }

    it "calls #probe method of each module passing a progress object" do
      expect(security).to receive(:probe).with(subject.progress)
      expect(network).to receive(:probe).with(subject.progress)
      expect(storage).to receive(:probe).with(subject.progress, subject.questions_manager)
      subject.probe
    end

    it "sets the status to probing" do
      expect(subject.status_manager).to receive(:change).with(DInstaller::Status::Probing)
      subject.probe
    end

    context "if any service has not finished the probing phase" do
      let(:software_status) { DInstaller::Status::Probing.new }
      let(:users_status) { DInstaller::Status::Probed.new }

      it "keeps the status as probing" do
        subject.probe
        expect(subject.status_manager.status).to eq(DInstaller::Status::Probing.new)
      end
    end

    context "if all services have finished the probing phase" do
      let(:software_status) { DInstaller::Status::Probed.new }
      let(:users_status) { DInstaller::Status::Probed.new }

      it "sets the status to probed" do
        subject.probe
        expect(subject.status_manager.status).to eq(DInstaller::Status::Probed.new)
      end
    end
  end

  describe "#install" do
    let(:bootloader_proposal) { instance_double(Bootloader::ProposalClient, make_proposal: nil) }
    let(:bootloader_finish) { instance_double(Bootloader::FinishClient, write: nil) }
    let(:users_client) { instance_double(DInstaller::DBus::Clients::Users, write: nil) }

    before do
      allow(Yast::WFM).to receive(:CallFunction)
      allow(Bootloader::ProposalClient).to receive(:new)
        .and_return(bootloader_proposal)
      allow(Bootloader::FinishClient).to receive(:new)
        .and_return(bootloader_finish)
      allow(DInstaller::DBus::Clients::Users).to receive(:new).and_return(users_client)
    end

    it "calls #install (or #write) method of each module passing a progress object" do
      expect(language).to receive(:install).with(subject.progress)
      expect(network).to receive(:install).with(subject.progress)
      expect(software).to receive(:install)
      expect(software).to receive(:probe)
      expect(software).to receive(:finish)
      expect(security).to receive(:write).with(subject.progress)
      expect(storage).to receive(:install).with(subject.progress)
      expect(storage).to receive(:finish)
      expect(users_client).to receive(:write).with(subject.progress)
      subject.install
    end

    it "proposes and writes the bootloader configuration" do
      expect(bootloader_proposal).to receive(:make_proposal)
      expect(bootloader_finish).to receive(:write)
      subject.install
    end

    it "sets the status to installing and installed" do
      expect(subject.status_manager).to receive(:change).with(DInstaller::Status::Installing)
      expect(subject.status_manager).to receive(:change).with(DInstaller::Status::Installed)
      subject.install
    end
  end
end
