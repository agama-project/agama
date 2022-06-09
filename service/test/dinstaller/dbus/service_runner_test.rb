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
require "dinstaller/dbus/service_runner"

describe DInstaller::DBus::ServiceRunner do
  describe "#run" do
    let(:logger) { Logger.new($stdout) }

    context "when the service :manager is chosen" do
      subject(:runner) { DInstaller::DBus::ServiceRunner.new(:manager) }

      let(:manager) { DInstaller::Manager.new(logger) }
      let(:service) { instance_double(DInstaller::DBus::Service) }

      before do
        allow(manager).to receive(:setup)
        allow(manager).to receive(:probe)
      end

      it "runs the manager service" do
        expect(DInstaller::Manager).to receive(:new).and_return(manager)
        expect(DInstaller::DBus::Service).to receive(:new).with(manager, Logger)
          .and_return(service)
        expect(service).to receive(:export)
        expect(EventMachine).to receive(:run)
        runner.run
      end
    end

    context "when another service chosen" do
      subject(:runner) { DInstaller::DBus::ServiceRunner.new(:users) }

      let(:service) { instance_double(DInstaller::DBus::Service) }

      it "runs the chosen service" do
        expect(DInstaller::DBus::UsersService).to receive(:new).with(Logger)
          .and_return(service)
        expect(service).to receive(:export)
        expect(EventMachine).to receive(:run)
        runner.run
      end
    end
  end
end
