#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017] SUSE LLC
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
require "y2storage/proposal/autoinst_size"

describe Y2Storage::Proposal::AutoinstSize do
  include_context "yast2-storage-ng test setup"

  subject(:autoinst_size) { described_class.new("10GB", max: max) }

  describe "#unlimited?" do
    context "when max size is unlimited" do
      let(:max) { Y2Storage::DiskSize.unlimited }

      it "returns true" do
        expect(autoinst_size).to be_unlimited
      end
    end

    context "when max size is nil" do
      let(:max) { nil }

      it "returns false" do
        expect(autoinst_size).to_not be_unlimited
      end
    end

    context "when max size is not unlimited" do
      let(:max) { Y2Storage::DiskSize.GiB(10) }

      it "returns false" do
        expect(autoinst_size).to_not be_unlimited
      end
    end
  end
end
