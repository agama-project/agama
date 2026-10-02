#!/usr/bin/env rspec
# frozen_string_literal: true

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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage/issue"

describe Y2Storage::Issue do
  include_context "yast2-storage-ng test setup"

  subject do
    described_class.new(message, description: description, details: details, device: device)
  end

  let(:message) { "Issue 1" }

  let(:details) { nil }

  let(:description) { nil }

  let(:device) { nil }

  describe "#message" do
    it "returns the given message" do
      expect(subject.message).to eq(message)
    end
  end

  describe "#description" do
    context "if a description is given" do
      let(:description) { "issue description" }

      it "returns the given description" do
        expect(subject.description).to eq(description)
      end
    end

    context "if a description is not given" do
      let(:description) { nil }

      it "returns nil" do
        expect(subject.description).to be_nil
      end
    end
  end

  describe "#details" do
    context "if details are given" do
      let(:details) { "issue details" }

      it "returns the given details" do
        expect(subject.details).to eq(details)
      end
    end

    context "if details are not given" do
      let(:details) { nil }

      it "returns nil" do
        expect(subject.details).to be_nil
      end
    end
  end

  describe "#sid" do
    context "if a device is given" do
      let(:device) { instance_double(Y2Storage::Device, sid: 10) }

      it "returns the sid of the given device" do
        expect(subject.sid).to eq(device.sid)
      end
    end

    context "if a device is not given" do
      let(:device) { nil }

      it "returns nil" do
        expect(subject.sid).to be_nil
      end
    end
  end
end
