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
    # SWIG returns ASCII-8BIT encoded strings even if they contain UTF-8 characters
    # see https://sourceforge.net/p/swig/feature-requests/89/
    it "handles ASCII-8BIT encoded messages with UTF-8 characters" do
      result = subject.error(
        (+"testing UTF-8 message: 🍺").force_encoding("ASCII-8BIT"),
        (+"details: 🍻").force_encoding("ASCII-8BIT")
      )

      expect(result).to eq(false)
    end

    it "logs the error and returns false" do
      expect(subject.log).to receive(:error).with(/the message.*the what/)

      result = subject.error(+"the message", +"the what")

      expect(result).to eq(false)
    end
  end
end
