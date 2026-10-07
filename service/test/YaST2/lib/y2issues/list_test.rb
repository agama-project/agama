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

describe Y2Issues::List do
  subject(:list) { described_class.new([issue]) }

  let(:issue) { Y2Issues::Issue.new("Something went wrong") }

  it "returns an array containing added issues" do
    expect(list.to_a).to eq([issue])
  end

  describe "#to_a" do
    context "when list is empty" do
      subject(:list) { described_class.new([]) }

      it "returns an empty array" do
        expect(list.to_a).to eq([])
      end
    end
  end

  describe "#empty?" do
    context "when list is empty" do
      subject(:list) { described_class.new([]) }

      it "returns true" do
        expect(list).to be_empty
      end
    end

    context "when some issue was added" do
      it "returns false" do
        expect(list).to_not be_empty
      end
    end
  end

  describe "#error?" do
    context "when contains some error" do
      let(:issue) { Y2Issues::Issue.new("Something went wrong", severity: :error) }

      it "returns true" do
        expect(list.error?).to eq(true)
      end
    end

    context "when does not contain any error error" do
      it "returns false" do
        expect(list.error?).to eq(false)
      end

    end
  end

  describe "#concat" do
    it "concats all passed Lists" do
      issue1 = Y2Issues::Issue.new("Something went wrong", severity: :fatal)
      issue2 = Y2Issues::Issue.new("Something went wrong2")
      issue3 = Y2Issues::Issue.new("Something went wrong3")
      expect(described_class.new([issue1]).concat(
        described_class.new([issue2]), described_class.new([issue3])
      ).to_a).to eq(
        described_class.new([issue1, issue2, issue3]).to_a
      )
    end
  end
end
