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

require_relative "issues_callback_examples"
require "y2storage/callbacks/probe"

describe Y2Storage::Callbacks::Probe do
  include_context "yast2-storage-ng test setup"

  subject(:callbacks) { described_class.new }

  describe "#issues" do
    include_examples "#issues"
  end

  describe "#error" do
    include_examples "#error"
  end

  describe "#begin" do
    it "clears again flag" do
      subject.begin
      expect(subject.again?).to be false
    end
  end

  describe "#again?" do
    context "when #begin has been called" do
      before { subject.begin }

      it "returns false" do
        expect(subject.again?).to be false
      end
    end
  end

  describe "#missing_command" do
    # unary +"..." to get mutable copies: #missing_command calls #force_encoding on the message
    let(:msg) { +"the message" }
    let(:what) { +"the what" }
    # unary +"..." to get a mutable copy: #missing_command calls #force_encoding on it too
    let(:cmd) { +"the command" }

    RSpec.shared_examples "generic error" do
      it "just generates the issue with error and the details" do
        subject.missing_command(msg, what, cmd, features)

        issue = subject.issues.first

        expect(issue.message).to eq(msg)
        expect(issue.details).to include(what)
      end

      it "returns true" do
        expect(subject.missing_command(msg, what, cmd, features)).to eq true
      end

      it "does not set #again? to true" do
        subject.begin
        subject.missing_command(msg, what, cmd, features)
        expect(subject.again?).to eq false
      end
    end

    context "if features is 0" do
      let(:features) { 0 }

      include_examples "generic error"
    end

    context "if features is not 0" do
      let(:features) { Storage::UF_BTRFS }

      include_examples "generic error"
    end
  end
end
