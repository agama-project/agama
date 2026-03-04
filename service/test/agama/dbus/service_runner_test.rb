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
require "agama/dbus/storage_service"
require "agama/storage/manager"

describe Agama::DBus::ServiceRunner do
  describe "#run" do
    subject(:runner) { Agama::DBus::ServiceRunner.new(:storage) }

    let(:storage) { instance_double(Agama::Storage::Manager) }
    let(:service) { instance_double(Agama::DBus::StorageService, start: nil) }

    before do
      allow(Agama::Storage::Manager).to receive(:new).and_return(storage)
      allow(Agama::DBus::StorageService).to receive(:new).and_return(service)
    end

    it "starts the given service" do
      expect(service).to receive(:start)
      expect(EventMachine).to receive(:run)
      runner.run
    end
  end
end
