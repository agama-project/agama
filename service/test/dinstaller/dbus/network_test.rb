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
require "dinstaller/dbus/network"
require "dinstaller/network/manager"

describe DInstaller::DBus::Network do
  subject { described_class.new(backend, logger) }

  let(:backend) do
    instance_double(DInstaller::Network::Manager, active_connections: [connection])
  end

  let(:logger) { Logger.new($stdout) }

  let(:connection) do
    DInstaller::Network::Connection.new(
      "enp1s0",
      "/org/freedesktop/NetworkManager/ActiveConnection/1",
      "802-3-ethernet",
      2,
      DInstaller::Network::IPConfig.new(
        "auto", [], "192.168.122.1"
      )
    )
  end

  describe "#active_connections" do
    it "returns an array of a hash-based representation of the connections" do
      expect(subject.active_connections).to eq(
        [
          { "id"    => "enp1s0",
            "ipv4"  => { "addresses" => [], "gateway" => "192.168.122.1", "method" => "auto" },
            "path"  => "/org/freedesktop/NetworkManager/ActiveConnection/1",
            "state" => 2,
            "type"  => "802-3-ethernet" }
        ]
      )
    end
  end
end
