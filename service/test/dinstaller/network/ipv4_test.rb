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
require "ipaddr"
require "dinstaller/network/ipv4"

describe DInstaller::Network::IPv4 do
  describe ".from_dbus" do
    it "returns an IPv4 object from a hash from D-Bus" do
      dbus_ipv4 = described_class.from_dbus(
        "method"      => "auto",
        "addresses"   => [{ "address" => "192.168.122.1", "prefix" => 24 }],
        "gateway"     => "192.168.122.1",
        "nameServers" => ["192.168.122.10"]
      )

      ipv4 = described_class.new(
        meth:        DInstaller::Network::ConnectionMethod::AUTO,
        addresses:   [{ address: "192.168.122.1", prefix: 24 }],
        gateway:     IPAddr.new("192.168.122.1"),
        nameservers: [IPAddr.new("192.168.122.10")]
      )
      expect(ipv4).to eq(dbus_ipv4)
    end
  end
end
