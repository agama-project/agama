# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "y2s390"

describe Y2S390::Dasd do
  subject { described_class.new("0.0.0150") }
  let(:dasda) do
    described_class.new("0.0.0150", status: "active", device_name: "dasda", type: "ECKD")
  end

  let(:execute) { instance_double("Yast::Execute") }

  before do
    allow(Yast::Execute).to receive(:stdout).and_return(execute)
  end

  describe "#hex_id" do
    it "returns an integer representation of the channel ID" do
      expect(subject.hex_id).to be_a(Integer)
      expect(subject.hex_id).to eql("000150".hex)
    end
  end

  describe "#active?" do
    it "returns true if the DASD status is :active or :read_only" do
      expect(dasda.active?).to eql(true)
    end

    it "returns false if it is offline" do
      expect(subject.active?).to eql(false)
    end
  end

  describe "#offline?" do
    subject { described_class.new("0.0.0190", status: "offline") }

    it "returns true if the DASD status is offline" do
      expect(subject.offline?).to eql(true)
    end

    it "returns false if the DASD status is not offline" do
      expect(dasda.offline?).to eql(false)
    end
  end

  describe "#status=" do
    context "when given a known status" do
      it "sets the corresponding one" do
        expect { subject.status = "offline" }.to change { subject.status }
          .from(:unknown).to(:offline)
        expect { subject.status = "active" }.to change { subject.status }
          .from(:offline).to(:active)
        expect { subject.status = "active(ro)" }.to change { subject.status }
          .from(:active).to(:read_only)
      end
    end

    context "when the given status is not known" do
      subject { described_class.new("0.0.0190", status: "offline") }

      it "sets the status as :unknown" do
        expect { subject.status = "another" }.to change { subject.status }
          .from(:offline).to(:unknown)
      end
    end
  end

  describe "#formatted?" do
    it "returns true if the DASD device is formmated according to internal state" do
      subject.formatted = true
      expect(subject.formatted?).to eql(true)
    end

    it "returns false otherwise" do
      subject.formatted = nil
      expect(subject.formatted?).to eql(false)
      subject.formatted = false
      expect(subject.formatted?).to eql(false)
    end
  end

  describe "#partition_info" do
    let(:fdasd) { "" }

    before do
      allow(execute).to receive(:on_target!).with("/sbin/fdasd", "-p", dasda.device_path)
        .and_return(fdasd)
    end

    context "when the DASD type is not ECKD" do
      let(:dasd_ffff) do
        described_class.new("0.0.ffff", status: "active(ro)", device_name: "dasda", type: "FBA")
      end

      it "assumes only one partition returning the device path with a 1 at the end" do
        expect(dasd_ffff.partition_info).to eql("/dev/dasda1")
      end
    end

    context "when the fdasd -p '/dev/device' output  does not contain any partition or is empty" do
      it "returns an empty string" do
        expect(dasda.partition_info).to eql("")
      end
    end

    context "when the fdasd -p '/dev/device' output contains some partition" do
      let(:fdasd) do
        File.read(File.join(FIXTURES_PATH, "yast2", "y2s390", "fdasd_partition.txt"))
      end
      let(:partition_info) do
        "/dev/dasda1 (Linux native), /dev/dasda2 (Linux native), /dev/dasda3 (Linux native)"
      end

      it "returns each partition info like '/dev/dasda1 (Linux native), /dev/dasda2 (Linux...'" do
        expect(dasda.partition_info).to eql(partition_info)
      end
    end
  end

  describe "#access_type" do
    let(:hwinfo) do
      OpenStruct.new(resource: OpenStruct.new(io: [OpenStruct.new(mode: "rw")]))
    end

    before do
      allow(Y2S390::HwinfoReader.instance).to receive(:for_device).with(dasda.id)
        .and_return(hwinfo)
    end

    it "returns the access type ('rw', 'ro') according to the hwinfo" do
      expect(dasda.access_type).to eql("rw")
    end
  end

  describe "#sys_device_name" do
    it "returns the associated device name read from the sysfs" do
      allow(execute).to receive(:on_target!).with(["ls", "/sys/bus/ccw/devices/0.0.0150/block/"])
        .and_return("#{dasda.device_name}\n")
      expect(dasda.sys_device_name).to eq("dasda")
    end
  end
end
