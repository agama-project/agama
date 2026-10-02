#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018-2021] SUSE LLC
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
require "y2storage"

describe Y2Storage::DevicegraphSanitizer do
  include_context "yast2-storage-ng test setup"

  subject { described_class.new(devicegraph) }

  let(:devicegraph) { devicegraph_from("mixed_disks") }
  let(:issues) { Y2Issues::List.new }

  before do
    allow(devicegraph).to receive(:probing_issues).and_return(issues)
  end

  describe "#sanitized_devicegraph" do
    it "returns a new devicegraph" do
      expect(subject.sanitized_devicegraph).to_not equal(devicegraph)
    end

    it "does not modify the initial devicegraph" do
      initial_devicegraph = devicegraph.dup
      subject.sanitized_devicegraph

      expect(devicegraph).to eq(initial_devicegraph)
    end

    it "does not create a new devicegraph in sequential calls" do
      sanitized = subject.sanitized_devicegraph

      expect(subject.sanitized_devicegraph).to equal(sanitized)
    end

    context "when there is a missing LVM PV issue" do
      let(:devicegraph) { devicegraph_from("lvm-four-vgs") }

      let(:vg4) { Y2Storage::LvmVg.find_by_vg_name(devicegraph, "vg4") }
      let(:vg6) { Y2Storage::LvmVg.find_by_vg_name(devicegraph, "vg6") }
      let(:vg10) { Y2Storage::LvmVg.find_by_vg_name(devicegraph, "vg10") }
      let(:vg30) { Y2Storage::LvmVg.find_by_vg_name(devicegraph, "vg30") }

      let(:issues) do
        Y2Issues::List.new(
          [
            Y2Storage::MissingLvmPvIssue.new(vg6),
            Y2Storage::MissingLvmPvIssue.new(vg30)
          ]
        )
      end

      it "returns a devicegraph without the issued LVM VGs" do
        expect(devicegraph.lvm_vgs).to contain_exactly(vg4, vg6, vg10, vg30)
        expect(subject.sanitized_devicegraph.lvm_vgs).to contain_exactly(vg4, vg10)
      end
    end

    context "when there is an inactive root issue" do
      let(:device) { devicegraph.find_by_name("/dev/sdb2") }

      let(:issues) do
        Y2Issues::List.new([Y2Storage::InactiveRootIssue.new(device)])
      end

      it "returns a devicegraph equal to the initial one" do
        expect(subject.sanitized_devicegraph).to eq(devicegraph)
      end
    end

    context "when there is an unsupported bcache issue" do
      let(:issues) do
        Y2Issues::List.new([Y2Storage::UnsupportedBcacheIssue.new])
      end

      it "returns a devicegraph equal to the initial one" do
        expect(subject.sanitized_devicegraph).to eq(devicegraph)
      end
    end

    context "when there are no issues" do
      let(:issues) { Y2Issues::List.new }

      it "returns a devicegraph equal to the initial one" do
        expect(subject.sanitized_devicegraph).to eq(devicegraph)
      end
    end
  end
end
