#!/usr/bin/env rspec
# Copyright (c) [2021] SUSE LLC
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
require "y2issues/invalid_value"

describe Y2Issues::InvalidValue do
  subject(:issue) do
    described_class.new("dhcpd", location: "file:/etc/sysconfig/network/ifcfg-eth0")
  end

  describe "#message" do
    it "returns a message explaining the problem" do
      expect(issue.message).to eq("Invalid value 'dhcpd'.")
    end

    context "when the nil value was given" do
      subject(:issue) do
        described_class.new(nil, location: "file:/etc/sysconfig/network/ifcfg-eth0")
      end

      it "returns a message explaining the problem" do
        expect(issue.message).to eq("A value is required.")
      end
    end

    context "when a fallback value is given" do
      subject(:issue) do
        described_class.new(
          "dhcpd", location: "file:/etc/sysconfig/network/ifcfg-eth0", fallback: "auto"
        )
      end

      it "includes the fallback value in the message" do
        expect(issue.message).to eq(
          "Invalid value 'dhcpd'. Using 'auto' instead."
        )
      end
    end
  end
end
