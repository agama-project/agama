# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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
require_relative "with_progress_examples"
require "agama/manager"
require "agama/config"
require "agama/http"
require "agama/issue"
require "agama/question"
require "agama/dbus/service_status"
require "agama/users"

describe Agama::Manager do
  subject { described_class.new(config, logger) }

  let(:config_path) do
    File.join(FIXTURES_PATH, "root_dir", "etc", "agama.yaml")
  end
  let(:config) { Agama::Config.from_file(config_path) }
  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:proxy) do
    instance_double(Agama::ProxySetup, propose: nil, install: nil)
  end

  let(:software) do
    instance_double(
      Agama::HTTP::Clients::Software,
      probe: nil, install: nil, propose: nil, finish: nil,
      config: { "product" => { "id" => product } }, errors?: false,
      selected_product: product
    )
  end
  let(:users) do
    instance_double(
      Agama::Users, write: nil, issues: []
    )
  end
  let(:http_client) { instance_double(Agama::HTTP::Clients::Main, install: nil) }
  let(:network) { instance_double(Agama::Network, install: nil, startup: nil) }
  let(:storage) do
    instance_double(
      Agama::DBus::Clients::Storage, probe: nil, install: nil, finish: nil,
      :product= => nil
    )
  end
  let(:scripts) do
    instance_double(
      Agama::HTTP::Clients::Scripts, run: nil
    )
  end

  let(:product) { nil }

  before do
    allow(Agama::Network).to receive(:new).and_return(network)
    allow(Agama::ProxySetup).to receive(:instance).and_return(proxy)
    allow(Agama::HTTP::Clients::Main).to receive(:new).and_return(http_client)
    allow(Agama::HTTP::Clients::Software).to receive(:new).and_return(software)
    allow(Agama::DBus::Clients::Storage).to receive(:new).and_return(storage)
    allow(Agama::Users).to receive(:new).and_return(users)
    allow(Agama::HTTP::Clients::Scripts).to receive(:new)
      .and_return(scripts)
  end

  describe "#startup_phase" do
    before do
      allow(subject).to receive(:config_phase)
    end

    it "sets the installation phase to startup" do
      subject.startup_phase
      expect(subject.installation_phase.startup?).to eq(true)
    end

    it "does the network startup configuration" do
      expect(network).to receive(:startup)
      subject.startup_phase
    end

    context "when there is no selected product" do
      let(:product) { nil }

      it "does not run the config phase" do
        expect(subject).to_not receive(:config_phase)
        subject.startup_phase
      end
    end

    context "when there is a selected product" do
      let(:product) { "Tumbleweed" }

      it "runs the config phase" do
        expect(subject).to receive(:config_phase)
        subject.startup_phase
      end
    end
  end

  describe "#config_phase" do
    let(:product) { "Geecko" }

    it "sets the installation phase to config" do
      subject.config_phase
      expect(subject.installation_phase.config?).to eq(true)
    end

    it "sets the product for the storage module" do
      expect(storage).to receive(:product=).with product
      subject.config_phase
    end

    it "calls #probe method for both software and storage modules if reprobe is requested" do
      expect(storage).to receive(:probe)
      expect(software).to receive(:probe)
      subject.config_phase(reprobe: true)
    end

    it "calls #probe method only for the software module if reprobe is not requested" do
      expect(software).to receive(:probe)
      expect(storage).to_not receive(:probe)
      subject.config_phase(reprobe: false)
    end
  end

  describe "#install_phase" do
    it "sets the installation phase to install and later to finish" do
      expect(subject.installation_phase).to receive(:install)
      subject.install_phase
      expect(subject.installation_phase.finish?).to eq(true)
    end

    it "calls #propose on proxy and software modules" do
      expect(proxy).to receive(:propose)
      expect(software).to receive(:propose)
      subject.install_phase
    end

    it "calls #install (or #write) method of each module" do
      expect(network).to receive(:install)
      expect(software).to receive(:install)
      expect(software).to receive(:finish)
      expect(http_client).to receive(:install)
      expect(storage).to receive(:install)
      expect(scripts).to receive(:run).with("postPartitioning")
      expect(storage).to receive(:finish)
      expect(users).to receive(:write)
      subject.install_phase
    end
  end

  let(:idle) { Agama::DBus::ServiceStatus::IDLE }
  let(:busy) { Agama::DBus::ServiceStatus::BUSY }

  describe "#busy_services" do
    before do
      allow(subject).to receive(:service_status_recorder).and_return(service_status_recorder)

      service_status_recorder.save("org.opensuse.Agama.Test1", busy)
      service_status_recorder.save("org.opensuse.Agama.Test2", idle)
      service_status_recorder.save("org.opensuse.Agama.Test3", busy)
    end

    let(:service_status_recorder) { Agama::ServiceStatusRecorder.new }

    it "returns the name of the busy services" do
      expect(subject.busy_services).to contain_exactly(
        "org.opensuse.Agama.Test1",
        "org.opensuse.Agama.Test3"
      )
    end
  end

  describe "#on_services_status_change" do
    before do
      allow(subject).to receive(:service_status_recorder).and_return(service_status_recorder)
    end

    let(:service_status_recorder) { Agama::ServiceStatusRecorder.new }

    it "add a callback to be run when the status of a service changes" do
      subject.on_services_status_change { logger.info("change status") }

      expect(logger).to receive(:info).with(/change status/)
      service_status_recorder.save("org.opensuse.Agama.Test", busy)
    end
  end

  describe "#valid?" do
    context "when there are not validation problems" do
      it "returns true" do
        expect(subject.valid?).to eq(true)
      end
    end

    context "when the users configuration is not valid" do
      before do
        allow(users).to receive(:issues).and_return([instance_double(Agama::Issue)])
      end

      it "returns false" do
        expect(subject.valid?).to eq(false)
      end
    end

    context "when the software configuration is not valid" do
      before do
        allow(software).to receive(:errors?).and_return(true)
      end

      it "returns false" do
        expect(subject.valid?).to eq(false)
      end
    end
  end

  describe "#finish_installation" do
    let(:finished) { false }
    let(:iguana) { true }
    let(:method) { "reboot" }

    before do
      allow(subject).to receive(:iguana?).and_return(iguana)
      allow(subject.installation_phase).to receive(:finish?).and_return(finished)
      allow(logger).to receive(:error)
    end

    context "when it is not in finish the phase" do
      it "logs the error and returns false" do
        expect(logger).to receive(:error).with(/not finished/)
        expect(subject.finish_installation(method)).to eq(false)
      end
    end

    context "when it is in the finish phase" do
      let(:finished) { true }

      context "and it is executed using iguana" do
        it "runs agamactl -k" do
          expect(subject).to receive(:system).with(/agamactl -k/).and_return(true)
          expect(subject.finish_installation(method)).to eq(true)
        end
      end

      context "and it is not executed using iguana" do
        let(:iguana) { false }

        it "executes the command to the finish method given" do
          expect(subject).to receive(:system).with(/shutdown -r now/).and_return(true)
          expect(subject.finish_installation(method)).to eq(true)
        end
      end
    end
  end

  describe "#collect_logs" do
    it "collects the logs and returns the path to the archive" do
      # %x returns the command output including trailing \n
      expect(subject).to receive(:`)
        .with("agama logs store ")
        .and_return("/tmp/y2log-hWBn95.tar.xz\n")

      path = subject.collect_logs
      expect(path).to eq("/tmp/y2log-hWBn95.tar.xz")
    end
  end

  include_examples "progress"
end
