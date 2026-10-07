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
require "y2issues"

describe Y2Issues::Issue do
  describe "#new" do
    subject(:issue) do
      described_class.new(
        "Something went wrong",
        location: Y2Issues::Location.parse("file:/etc/hosts"),
        severity: :error
      )
    end

    it "creates an issue" do
      expect(issue.message).to eq("Something went wrong")
      expect(issue.location).to eq(Y2Issues::Location.parse("file:/etc/hosts"))
      expect(issue.severity).to eq(:error)
    end

    context "when location is given as a string" do
      subject(:issue) do
        described_class.new(
          "Something went wrong",
          location: "file:/etc/hosts"
        )
      end

      it "parses the given location" do
        expect(issue.location).to eq(Y2Issues::Location.parse("file:/etc/hosts"))
      end
    end

    context "when a severity is not given" do
      subject(:issue) { described_class.new("Something went wrong") }

      it "sets the severity to :warn" do
        expect(issue.severity).to eq(:warn)
      end
    end
  end

  describe "#error?" do
    context "when severity is :error" do
      subject(:issue) { described_class.new("Something went wrong", severity: :error) }

      it "returns true" do
        expect(issue.error?).to eq(true)
      end
    end

    context "when severity is :error" do
      subject(:issue) { described_class.new("Something went wrong", severity: :warn) }

      it "returns false" do
        expect(issue.error?).to eq(false)
      end
    end
  end
end
