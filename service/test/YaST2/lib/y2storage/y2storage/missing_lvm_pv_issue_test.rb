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
require "y2storage/missing_lvm_pv_issue"

describe Y2Storage::MissingLvmPvIssue do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(device) }

  let(:scenario) { "lvm-errors1-devicegraph.xml" }
  let(:devicegraph) { devicegraph_from(scenario) }
  let(:device) { devicegraph.find_by_name("/dev/test1") }

  describe "#message" do
    it "returns a message for incomplete LVM VG" do
      expect(subject.message).to match("volume group /dev/test1 is incomplete")
    end
  end

  describe "#description" do
    before do
      allow(Yast::Mode).to receive(:installation).and_return(installation)
    end

    context "during installation" do
      let(:installation) { true }

      it "includes warning about volume group deletion" do
        expect(subject.description)
          .to match("volume group will be deleted later as part of the installation")
      end

      it "includes warning about ignoring them during proposal" do
        expect(subject.description).to match("ignored by the partitioning proposal")
      end

      it "includes warning about visibility in Expert Partitioner" do
        expect(subject.description).to match("not visible in the Expert Partitioner")
      end
    end

    context "in the running system" do
      let(:installation) { false }

      it "includes warning about volume group deletion" do
        expect(subject.description).to match("will be deleted at the final step")
      end

      it "includes warning about visibility in Expert Partitioner" do
        expect(subject.description).to match("are not visible")
      end
    end
  end

  describe "#details" do
    it "returns nil" do
      expect(subject.details).to be_nil
    end
  end
end
