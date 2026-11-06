# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../../../test_helper"
require "y2s390/hwinfo_reader"

# NOTE: this class has no upstream test at all (neither a unit test nor an interactive-UI one), so
# this spec was written from scratch while vendoring, based on reading the real source
# (see service/YaST2/README.md).
describe Y2S390::HwinfoReader do
  subject { described_class.instance }

  let(:raw_disks) do
    [
      {
        "sysfs_bus_id" => "0.0.0160",
        "resource"     => {
          "io" => [{ "active" => true, "mode" => "rw" }]
        },
        "detail"       => { "cu_model" => 233, "dev_model" => 10 }
      },
      {
        "sysfs_bus_id" => "0.0.0150",
        "resource"     => {
          "io" => [{ "active" => false, "mode" => "ro" }]
        }
      }
    ]
  end

  before do
    subject.reset
    allow(subject).to receive(:disks).and_return(raw_disks)
  end

  describe "#for_device" do
    it "returns the hwinfo data for the device with the given id" do
      result = subject.for_device("0.0.0160")

      expect(result.sysfs_bus_id).to eq("0.0.0160")
      expect(result.resource.io.first.mode).to eq("rw")
      expect(result.detail.cu_model).to eq(233)
    end

    it "returns nil if there is no hwinfo data for the given id" do
      expect(subject.for_device("0.0.9999")).to be_nil
    end

    it "caches the data between calls" do
      subject.for_device("0.0.0160")

      expect(subject).to_not receive(:disks)

      subject.for_device("0.0.0150")
    end

    context "when force_probing is given" do
      it "discards the cached data and reads it again" do
        subject.for_device("0.0.0160")

        expect(subject).to receive(:disks).and_return(raw_disks)

        subject.for_device("0.0.0160", force_probing: true)
      end
    end
  end

  describe "#reset" do
    it "discards the cached data" do
      subject.for_device("0.0.0160")

      subject.reset

      expect(subject).to receive(:disks).and_return(raw_disks)

      subject.for_device("0.0.0160")
    end
  end

  describe "#data" do
    it "returns a hash indexed by the sysfs bus id of each device" do
      expect(subject.data.keys).to contain_exactly("0.0.0160", "0.0.0150")
    end

    it "memoizes the result" do
      first = subject.data

      expect(subject.data).to equal(first)
    end
  end
end
