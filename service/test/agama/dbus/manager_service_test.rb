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
require "agama/dbus/manager_service"
require "agama/config"

describe Agama::DBus::ManagerService do
  subject(:service) { described_class.new(config, logger) }

  let(:config) { Agama::Config.new }
  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:manager) { Agama::Manager.new(config, logger) }
  let(:locale_service) { double(object: double(instrospect: nil)) }
  let(:bus) { instance_double(Agama::DBus::Bus, request_name: nil, service: locale_service) }
  let(:bus_service) do
    instance_double(::DBus::ObjectServer, export: nil)
  end
  let(:cockpit) { instance_double(Agama::CockpitManager, setup: nil) }
  let(:software_client) do
    instance_double(Agama::DBus::Clients::Software, on_product_selected: nil)
  end

  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:object_server).and_return(bus_service)
    allow(Agama::Manager).to receive(:new).with(config, logger).and_return(manager)
    allow(Agama::CockpitManager).to receive(:new).and_return(cockpit)
    allow(manager).to receive(:software).and_return(software_client)
  end

  describe "#start" do
    it "runs the startup phase" do
      expect(manager).to receive(:startup_phase)
      subject.start
    end
  end

  describe "#export" do
    it "exports the manager object" do
      manager_obj = instance_double(Agama::DBus::Manager, path: nil)
      allow(Agama::DBus::Manager).to receive(:new)
        .with(manager, logger).and_return(manager_obj)

      expect(bus_service).to receive(:export).with(manager_obj)
      service.export
    end
  end

  describe "#dispatch" do
    it "dispatches the messages from the bus" do
      expect(bus).to receive(:dispatch_message_queue)
      service.dispatch
    end
  end
end
