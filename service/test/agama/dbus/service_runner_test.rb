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
require "agama/config"
require "agama/dbus/service_runner"
require "agama/dbus/manager_service"
require "agama/manager"

describe DInstaller::DBus::ServiceRunner do
  describe "#run" do
    subject(:runner) { DInstaller::DBus::ServiceRunner.new(:manager) }

    let(:config) { DInstaller::Config.new }
    let(:logger) { Logger.new($stdout) }
    let(:manager) { DInstaller::Manager.new(config, logger) }
    let(:service) { instance_double(DInstaller::DBus::ManagerService) }

    before do
      allow(DInstaller::Config).to receive(:current).and_return(config)
      allow(DInstaller::Manager).to receive(:new).with(config).and_return(manager)
      allow(DInstaller::DBus::ManagerService).to receive(:new).with(config, Logger)
        .and_return(service)
    end

    it "starts the given service" do
      expect(service).to receive(:start)
      expect(EventMachine).to receive(:run)
      runner.run
    end
  end
end
