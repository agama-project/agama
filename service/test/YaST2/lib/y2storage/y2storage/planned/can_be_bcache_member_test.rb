#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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
require "y2storage"

describe Y2Storage::Planned::CanBeBcacheMember do
  include_context "yast2-storage-ng test setup"

  # Dummy class to test the mixin
  class BcacheMemberDevice < Y2Storage::Planned::Device
    include Y2Storage::Planned::CanBeBcacheMember

    def initialize
      super
      initialize_can_be_bcache_member
    end
  end

  subject(:planned) { BcacheMemberDevice.new }

  describe "#bcache_caching_device?" do
    context "when the device acts as a caching device" do
      before do
        planned.bcache_caching_for = ["/dev/bcache0"]
      end

      it "returns true" do
        expect(planned.bcache_caching_device?).to eq(true)
      end
    end

    context "when the device does not act as a caching device" do
      it "returns false" do
        expect(planned.bcache_caching_device?).to eq(false)
      end
    end
  end

  describe "#bcache_backing_device?" do
    context "when the device acts as a backing device" do
      before do
        planned.bcache_backing_for = "/dev/bcache0"
      end

      it "returns true" do
        expect(planned.bcache_backing_device?).to eq(true)
      end
    end

    context "when the device does not act as a backing device" do
      it "returns false" do
        expect(planned.bcache_caching_device?).to eq(false)
      end
    end
  end

  describe "#bcache_member?" do
    context "when it is set as a bcache caching device" do
      before do
        planned.bcache_caching_for = ["/dev/bcache0"]
      end

      it "returns true" do
        expect(planned.bcache_member?).to eq(true)
      end
    end

    context "when it is set as a bcache backing device" do
      before do
        planned.bcache_backing_for = "/dev/bcache0"
      end

      it "returns true" do
        expect(planned.bcache_member?).to eq(true)
      end
    end

    context "when it is not set as bcache caching or backing device" do
      it "returns false" do
        expect(planned.bcache_member?).to eq(false)
      end
    end
  end

  describe "#bcache_caching_for?" do
    let(:bcache_name) { "/dev/bcache0" }

    context "when it is set as a bcache caching device for the mentioned bcache" do
      before do
        planned.bcache_caching_for = [bcache_name]
      end

      it "returns true" do
        expect(planned.bcache_caching_for?("/dev/bcache0")).to eq(true)
      end
    end

    context "when it is set as a bcache caching device for a different bcache" do
      before do
        planned.bcache_caching_for = ["/dev/bcache1"]
      end

      it "returns false" do
        expect(planned.bcache_caching_for?(bcache_name)).to eq(false)
      end
    end

    context "when it is not set as a bcache caching device" do
      it "returns false" do
        expect(planned.bcache_caching_for?(bcache_name)).to eq(false)
      end
    end
  end

  describe "#bcache_backing_for?" do
    let(:bcache_name) { "/dev/bcache0" }

    context "when it is set as a bcache backing device for the mentioned bcache" do
      before do
        planned.bcache_backing_for = bcache_name
      end

      it "returns true" do
        expect(planned.bcache_backing_for?("/dev/bcache0")).to eq(true)
      end
    end

    context "when it is set as a bcache backing device for a different bcache" do
      before do
        planned.bcache_backing_for = "/dev/bcache1"
      end

      it "returns false" do
        expect(planned.bcache_backing_for?(bcache_name)).to eq(false)
      end
    end

    context "when it is not set as a bcache backing device" do
      it "returns false" do
        expect(planned.bcache_backing_for?(bcache_name)).to eq(false)
      end
    end
  end
end
