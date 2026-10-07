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
require "y2issues/location"

describe Y2Issues::Location do
  subject(:location) do
    described_class.new("file", "/etc/hosts", "1")
  end

  describe ".parse" do
    it "returns a location with the given components" do
      location = described_class.parse("file:/etc/hosts:1")
      expect(location.type).to eq("file")
      expect(location.path).to eq("/etc/hosts")
      expect(location.id).to eq("1")
    end
  end

  describe "#==" do
    context "when locations have the same values" do
      let(:other) do
        described_class.new("file", "/etc/hosts", "1")
      end

      it "returns true" do
        expect(location).to eq(other)
      end
    end

    context "when locations have different values" do
      let(:other) do
        described_class.new("file", "/etc/resolv.conf")
      end

      it "returns true" do
        expect(location).to_not eq(other)
      end
    end
  end

  describe "#to_s" do
    it "returns a string based representation of the location" do
      expect(location.to_s).to eq("file:/etc/hosts:1")
    end

    context "when the ID is missing" do
      subject(:location) {  described_class.new("file", "/etc/hosts") }

      it "does not include the ID" do
        expect(location.to_s).to eq("file:/etc/hosts")
      end
    end
  end
end
