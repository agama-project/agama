# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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
require "agama/dbus/storage/dasd"
require "agama/dbus/storage_service"
require "agama/storage/dasd/manager"
require "agama/storage/iscsi/adapter"
require "yast"

describe Agama::DBus::StorageService do
  subject(:service) { described_class.new(logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:manager) { Agama::Storage::Manager.new(logger: logger) }
  let(:inhibitors) { instance_double(Y2Storage::Inhibitors, inhibit: nil, uninhibit: nil) }

  let(:object_server) { instance_double(DBus::ObjectServer, export: nil) }
  let(:bus) { instance_double(Agama::DBus::Bus, request_name: nil) }

  let(:manager_obj) do
    instance_double(Agama::DBus::Storage::Manager, path: "/org/opensuse/Agama/Storage1")
  end

  let(:iscsi_obj) do
    instance_double(Agama::DBus::Storage::ISCSI, path: "/org/opensuse/Agama/Storage1/ISCSI")
  end

  let(:dasd_obj) do
    instance_double(Agama::DBus::Storage::DASD, path: "/org/opensuse/Agama/Storage1/DASD")
  end

  let(:dasd) { instance_double(Agama::Storage::DASD::Manager) }

  before do
    allow(Agama::DBus::Bus).to receive(:current).and_return(bus)
    allow(bus).to receive(:request_service).with("org.opensuse.Agama.Storage1")
      .and_return(object_server)
    allow(Y2Storage::Inhibitors).to receive(:new).and_return inhibitors
    allow(Agama::Storage::Manager).to receive(:new).with(logger: logger)
      .and_return(manager)
    allow(Agama::DBus::Storage::Manager).to receive(:new).with(manager, logger: logger)
      .and_return(manager_obj)
    allow(Agama::DBus::Storage::ISCSI).to receive(:new).and_return(iscsi_obj)
    allow(Agama::DBus::Storage::DASD).to receive(:new).and_return(dasd_obj)
    allow(Agama::Storage::DASD::Manager).to receive(:new).and_return(dasd)
    allow_any_instance_of(Agama::Storage::ISCSI::Adapter).to receive(:activate)
  end

  describe "#start" do
    it "activates the Y2Storage inhibitors" do
      expect(inhibitors).to receive(:inhibit)
      service.start
    end

    it "activates iSCSI" do
      expect_any_instance_of(Agama::Storage::ISCSI::Adapter).to receive(:activate)
      service.start
    end
  end

  describe "#export" do
    it "exports the storage manager" do
      expect(object_server).to receive(:export).with(manager_obj)
      service.export
    end

    it "exports the ISCSI manager" do
      expect(object_server).to receive(:export).with(iscsi_obj)
      service.export
    end

    context "in a s390 system" do
      before do
        allow(Yast::Arch).to receive(:s390).and_return(true)
      end

      it "exports the ISCSI manager" do
        expect(object_server).to receive(:export).with(dasd_obj)
        service.export
      end
    end

    context "with other arch" do
      before do
        allow(Yast::Arch).to receive(:s390).and_return(false)
      end

      it "does not export the ISCSI manager" do
        expect(object_server).to_not receive(:export).with(dasd_obj)
        service.export
      end
    end
  end

  describe "#dispatch" do
    it "dispatches the messages from the bus" do
      expect(bus).to receive(:dispatch_message_queue)
      service.dispatch
    end
  end
end
