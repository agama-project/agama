#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2021] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage/callbacks/commit"

describe Y2Storage::Callbacks::Commit do
  include_context "yast2-storage-ng test setup"

  subject(:callbacks) { described_class.new }

  describe "#message" do
    context "when a widget is given" do
      subject { described_class.new(widget: widget) }

      let(:widget) { double("Actions", add_action: nil) }

      let(:message) { "a message" }

      it "calls #add_action over the widget" do
        expect(widget).to receive(:add_action).with(message)

        subject.message(message)
      end
    end
  end

  describe "#error" do
    before do
      allow(Y2Storage::IssuesReporter).to receive(:new).and_return(reporter)
    end

    let(:reporter) { instance_double(Y2Storage::IssuesReporter, report: accept) }

    let(:accept) { true }

    # SWIG returns ASCII-8BIT encoded strings even if they contain UTF-8 characters
    # see https://sourceforge.net/p/swig/feature-requests/89/
    it "handles ASCII-8BIT encoded messages with UTF-8 characters" do
      expect(Y2Storage::IssuesReporter).to receive(:new) do |issues|
        expect(issues.to_a.first.message).to include "🍺"
        expect(issues.to_a.first.details).to include "🍻"
        reporter
      end

      # unary +"..." to get mutable copies: #error calls #force_encoding on both arguments
      subject.error(
        (+"testing UTF-8 message: 🍺").force_encoding("ASCII-8BIT"),
        (+"details: 🍻").force_encoding("ASCII-8BIT")
      )
    end

    it "reports the error" do
      expect(Y2Storage::IssuesReporter).to receive(:new) do |issues|
        expect(issues.to_a.size).to eq(1)
        expect(issues.to_a.first.message).to eq("the message")
        expect(issues.to_a.first.details).to eq("the what")
        reporter
      end

      expect(reporter).to receive(:report)

      subject.error(+"the message", +"the what")
    end

    context "if the user accepts to continue" do
      let(:accept) { true }

      it "returns true" do
        result = subject.error(+"the message", +"the what")

        expect(result).to eq(true)
      end
    end

    context "if the user does not accept to continue" do
      let(:accept) { false }

      it "returns false" do
        result = subject.error(+"the message", +"the what")

        expect(result).to eq(false)
      end
    end
  end
end
