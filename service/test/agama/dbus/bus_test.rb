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
require "agama/dbus/bus"

describe DInstaller::DBus::Bus do
  describe ".current" do
    let(:server_manager) do
      DInstaller::DBus::ServerManager.new(run_directory: "/tmp")
    end

    before do
      allow(DInstaller::DBus::ServerManager).to receive(:new).and_return(server_manager)
      allow(server_manager).to receive(:find_or_start_server)
    end

    it "returns a connection to the current server" do
      bus = instance_double(DInstaller::DBus::Bus)
      expect(described_class).to receive(:new).with(server_manager.address)
        .and_return(bus)
      expect(described_class.current).to eq(bus)
    end
  end
end
