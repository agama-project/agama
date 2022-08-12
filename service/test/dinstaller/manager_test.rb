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
require "dinstaller/question"
require "dinstaller/dbus/service_status"
require "dinstaller/dbus/clients/questions_manager"

describe DInstaller::Manager do
  subject { described_class.new(config, logger) }

  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "d-installer.yaml")
  end
  let(:config) { DInstaller::Config.from_file(config_path) }
  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:software) do
    instance_double(
      DInstaller::DBus::Clients::Software,
      probe: nil, install: nil, propose: nil, finish: nil, on_product_selected: nil,
      on_service_status_change: nil
    )
  end
  let(:users) do
    instance_double(DInstaller::DBus::Clients::Users, write: nil, on_service_status_change: nil)
  end
  let(:language) { instance_double(DInstaller::DBus::Clients::Language, finish: nil) }
  let(:network) { instance_double(DInstaller::Network, probe: nil, install: nil) }
  let(:storage) do
    instance_double(DInstaller::Storage::Manager, probe: nil, install: nil, finish: nil)
  end
  let(:security) { instance_double(DInstaller::Security, probe: nil, write: nil) }
  let(:questions_manager) { instance_double(DInstaller::QuestionsManager) }

  before do
    allow(DInstaller::Network).to receive(:new).and_return(network)
    allow(DInstaller::Security).to receive(:new).and_return(security)
    allow(DInstaller::DBus::Clients::Language).to receive(:new).and_return(language)
    allow(DInstaller::DBus::Clients::Software).to receive(:new).and_return(software)
    allow(DInstaller::DBus::Clients::Users).to receive(:new).and_return(users)
    allow(DInstaller::Storage::Manager).to receive(:new).and_return(storage)
    allow(DInstaller::QuestionsManager).to receive(:new).and_return(questions_manager)
  end

  describe "#startup_phase" do
    before do
      allow(subject).to receive(:config_phase)
    end

    it "sets the installation phase to startup" do
      subject.startup_phase
      expect(subject.installation_phase.startup?).to eq(true)
    end

    context "when only one product is defined" do
      let(:config_path) do
        File.join(FIXTURES_PATH, "d-installer-single.yaml")
      end

      it "adjusts the configuration and runs the config phase" do
        expect(subject).to receive(:config_phase)
        subject.startup_phase
      end
    end
  end

  describe "#config_phase" do
    before do
      allow(subject).to receive(:testing_question)
      allow(software).to receive(:testing_question)
    end

    it "sets the installation phase to config" do
      subject.config_phase
      expect(subject.installation_phase.config?).to eq(true)
    end

    it "calls #probe method of each module" do
      expect(security).to receive(:probe)
      expect(network).to receive(:probe)
      expect(storage).to receive(:probe).with(subject.questions_manager)
      subject.config_phase
    end
  end

  describe "#install_phase" do
    let(:bootloader_proposal) { instance_double(Bootloader::ProposalClient, make_proposal: nil) }
    let(:bootloader_finish) { instance_double(Bootloader::FinishClient, write: nil) }

    before do
      allow(Yast::WFM).to receive(:CallFunction)
      allow(Bootloader::ProposalClient).to receive(:new)
        .and_return(bootloader_proposal)
      allow(Bootloader::FinishClient).to receive(:new)
        .and_return(bootloader_finish)
    end

    it "sets the installation phase to install" do
      subject.install_phase
      expect(subject.installation_phase.install?).to eq(true)
    end

    it "calls #install (or #write) method of each module" do
      expect(network).to receive(:install)
      expect(software).to receive(:install)
      expect(software).to receive(:probe)
      expect(software).to receive(:finish)
      expect(language).to receive(:finish)
      expect(security).to receive(:write)
      expect(storage).to receive(:install)
      expect(storage).to receive(:finish)
      expect(users).to receive(:write)
      subject.install_phase
    end

    it "proposes and writes the bootloader configuration" do
      expect(bootloader_proposal).to receive(:make_proposal)
      expect(bootloader_finish).to receive(:write)
      subject.install_phase
    end
  end

  let(:idle) { DInstaller::DBus::ServiceStatus::IDLE }
  let(:busy) { DInstaller::DBus::ServiceStatus::BUSY }

  describe "#busy_services" do
    before do
      allow(subject).to receive(:service_status_recorder).and_return(service_status_recorder)

      service_status_recorder.save("org.opensuse.DInstaller.Test1", busy)
      service_status_recorder.save("org.opensuse.DInstaller.Test2", idle)
      service_status_recorder.save("org.opensuse.DInstaller.Test3", busy)
    end

    let(:service_status_recorder) { DInstaller::ServiceStatusRecorder.new }

    it "returns the name of the busy services" do
      expect(subject.busy_services).to contain_exactly(
        "org.opensuse.DInstaller.Test1",
        "org.opensuse.DInstaller.Test3"
      )
    end
  end

  describe "#on_services_status_change" do
    before do
      allow(subject).to receive(:service_status_recorder).and_return(service_status_recorder)
    end

    let(:service_status_recorder) { DInstaller::ServiceStatusRecorder.new }

    it "add a callback to be run when the status of a service changes" do
      subject.on_services_status_change { logger.info("change status") }

      expect(logger).to receive(:info).with(/change status/)
      service_status_recorder.save("org.opensuse.DInstaller.Test", busy)
    end
  end

  describe "#select_product" do
    before do
      allow(subject).to receive(:testing_question)
      allow(software).to receive(:testing_question)
    end

    it "configures the given product as selected product" do
      subject.select_product("Leap")
      expect(config.data["software"]["base_product"]).to eq("Leap")
      expect(config.pure_data["software"]).to be_nil
    end

    it "runs the config phase" do
      expect(subject).to receive(:config_phase)
      subject.select_product("Leap")
    end
  end

  describe "#testing_question" do
    let(:question_stub) { instance_double(DInstaller::DBus::Clients::Question, answer: :blue) }

    # this is a clumsy way to test the CanAskQuestion mixin
    it "uses CanAskQuestion#ask" do
      expect(questions_manager).to receive(:add).and_return(question_stub)
      expect(questions_manager).to receive(:wait)
      expect(questions_manager).to receive(:delete)

      question = DInstaller::Question.new("What is your favorite color?", options: [:blue, :yellow])
      correct = subject.ask(question) do |q|
        q.answer == :blue
      end
      expect(correct).to be true
    end
  end
end
