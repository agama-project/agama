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
require "y2storage/probed_devicegraph_checker"

describe Y2Storage::ProbedDevicegraphChecker do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(devicegraph) }

  describe "#issues" do
    context "when the devicegraph does not contain issues" do
      let(:devicegraph) { devicegraph_from("lvm-two-vgs") }

      it "returns an empty list" do
        expect(subject.issues).to be_empty
      end
    end

    context "when there are LVM VGs with missing PV" do
      let(:devicegraph) { devicegraph_from("lvm-errors1-devicegraph.xml") }

      before do
        Y2Storage::LvmVg.create(devicegraph, "test3")
      end

      it "contains missing PVs issues" do
        expect(subject.issues).to all(be_an(Y2Storage::MissingLvmPvIssue))
      end

      it "contains an issue for each LVM VG with missing PVs" do
        vg1 = devicegraph.find_by_name("/dev/test1")
        vg2 = devicegraph.find_by_name("/dev/test2")

        expect(subject.issues.map(&:sid)).to contain_exactly(vg1.sid, vg2.sid)
      end

      it "does not contain an issue for correct LVM VGs" do
        vg3 = devicegraph.find_by_name("/dev/test3")

        expect(subject.issues.map(&:sid)).to_not include(vg3.sid)
      end
    end

    context "when there is a bcache device" do
      before do
        # Unmock #unsupported_bcache?, see RSpec config at spec_helper.rb
        allow_any_instance_of(Y2Storage::ProbedDevicegraphChecker)
          .to receive(:unsupported_bcache?).and_call_original
      end

      # NOTE: the devicegraph is only loaded but not probed, see {#devicegraph_from}. If the
      # devicegraph is probed, then the test would fail because a Bcache error is reported.
      let(:devicegraph) { devicegraph_from("bcache2.xml") }

      context "on an architecture that supports bcache (x86_64)" do
        let(:architecture) { :x86_64 }

        it "does not contain an issue" do
          expect(subject.issues).to be_empty
        end
      end

      context "on an architecture that does not support bcache (ppc)" do
        let(:architecture) { :ppc }

        it "contains an unsupported bcache issue" do
          issues = subject.issues
          expect(issues).not_to be_empty
          expect(issues).to include(be_a(Y2Storage::UnsupportedBcacheIssue))
        end
      end
    end

    context "when the mount point for the root filesystem is not active" do
      let(:devicegraph) { devicegraph_from("mixed_disks") }

      before do
        allow_any_instance_of(Y2Storage::MountPoint).to receive(:active?).and_return(false)
      end

      it "contains an issues for inactive root" do
        issues = subject.issues
        expect(issues).not_to be_empty

        expect(issues).to include(be_a(Y2Storage::InactiveRootIssue))
      end
    end
  end
end
