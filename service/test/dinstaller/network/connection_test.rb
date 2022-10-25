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
require "dinstaller/network/connection"

describe DInstaller::Network::Connection do
  subject do
    DInstaller::Network::Connection.new("1234", "Wired")
  end

  describe ".from_dbus" do
    it "returns a Connection instance" do
      connection = described_class.from_dbus(
        "id"   => "1234",
        "name" => "Wired",
        "ipv4" => { "method" => "manual" }
      )
      expect(connection.id).to eq("1234")
      expect(connection.name).to eq("Wired")
      expect(connection.ipv4.meth).to eq(DInstaller::Network::ConnectionMethod::MANUAL)
    end
  end

  describe "#to_dbus" do
    it "returns a hash containing the information to send over D-Bus" do
      expect(subject.to_dbus)
    end
  end
end
