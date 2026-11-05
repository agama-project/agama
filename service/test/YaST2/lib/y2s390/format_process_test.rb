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
require "y2s390/format_process"

describe Y2S390::FormatStatus do
  let(:dasd) { Y2S390::Dasd.new("0.0.0150", status: "active", type: "ECKD") }

  subject { described_class.new(dasd, 1016) }

  describe "#update_progress!" do
    it "increases the progress by the format size" do
      expect { subject.update_progress! }.to change { subject.progress }.from(0).to(10)
      expect { subject.update_progress! }.to change { subject.progress }.from(10).to(20)
    end
  end

  describe "#done?" do
    it "returns true when all the cylinders have been formatted" do
      expect(subject.done?).to eql(false)
      100.times { subject.update_progress! }
      expect(subject.done?).to eql(false)
      expect(subject.progress).to eql(1000)
      subject.update_progress!
      expect(subject.progress).to eql(1010)
      expect(subject.done?).to eql(true)
    end

    it "returns false otherwise" do
      expect(subject.done?).to eql(false)
    end
  end
end

describe Y2S390::FormatProcess do
  let(:subject) { described_class.new(dasds) }
  let(:dasd_0150) do
    Y2S390::Dasd.new("0.0.0150", status: "active", type: "ECKD", device_name: "dasda")
  end
  let(:dasd_0160) do
    Y2S390::Dasd.new("0.0.0160", status: "active", type: "ECKD", device_name: "dasdb")
  end

  let(:dasds) { [dasd_0150, dasd_0160] }
  let(:process_id) { 35_000 }

  before do
    allow(Yast::SCR).to receive(:Execute)
      .with(Yast.path(".process.start_shell"), /dasdfmt -Y/).and_return(process_id)
  end

  describe "#start" do
    it "starts a dasdfmt process in parallel with the disks given" do
      expect(Yast::SCR).to receive(:Execute).with(
        Yast.path(".process.start_shell"),
        "/sbin/dasdfmt -Y -P 2 -b 4096 -y -r 10 -m 10 -f /dev/dasda -f /dev/dasdb"
      )
      subject.start
    end

    it "returns the process id" do
      expect(Yast::SCR).to receive(:Execute).with(anything, anything).and_return(process_id)
      expect(subject.start).to eql(process_id)
    end
  end

  describe "#running?" do
    it "returns false if the process has not started" do
      expect(subject.running?).to eql(false)
    end

    it "returns whether the format process is still running or not" do
      subject.start
      expect(Yast::SCR).to receive(:Read).with(Yast.path(".process.running"), process_id)
        .and_return(true, false)
      expect(subject.running?).to eql(true)
      expect(subject.running?).to eql(false)
    end
  end

  describe "#read" do
    let(:process_output) { "0|1|0|\n1|0|0" }

    before do
      allow(Yast::SCR).to receive(:Read)
        .with(Yast.path(".process.read"), process_id).and_return(process_output)
    end

    it "returns nil if no process has been started" do
      expect(subject.read).to eq(nil)
    end

    it "returns the output of the YaST process agent read" do
      subject.start

      expect(subject.read).to eq(process_output)
    end
  end

  describe "#read_line" do
    before do
      allow(Yast::SCR).to receive(:Read)
        .with(Yast.path(".process.read_line"), process_id).and_return("1500")
    end

    it "returns nil if no process has been started" do
      expect(subject.read_line).to eq(nil)
    end

    it "returns the output of the YaST process agent read_line" do
      subject.start

      expect(subject.read_line).to eql("1500")
    end
  end

  describe "#status" do
    before do
      allow(Yast::SCR).to receive(:Read)
        .with(Yast.path(".process.status"), process_id).and_return(0)
    end

    it "returns nil if no process has been started" do
      expect(subject.status).to eq(nil)
    end

    it "returns the output of the YaST process agent status" do
      subject.start

      expect(subject.status).to eq(0)
    end
  end

  describe "#error" do
    it "returns an empty string if there is no stderr for the format process" do
      expect(Yast::SCR).to receive(:Read)
        .with(Yast.path(".process.read_line_stderr"), nil).and_return(nil)

      expect(subject.error).to eq("")
    end

    it "returns the format process stderr" do
      error = "dasdfmt: Disk /dev/dasdb is read only!"
      subject.start

      expect(Yast::SCR).to receive(:Read)
        .with(Yast.path(".process.read_line_stderr"), process_id).and_return(error, nil)

      expect(subject.error).to eq(error)
    end
  end

  describe "#initialize_summary" do
    before do
      allow(subject).to receive(:read_line).and_return("1500", "900")
    end

    it "initializes the summary with the number of cylinders to be formatted by each DASD" do
      expect(subject.summary).to eql({})
      subject.initialize_summary
      expect(subject.summary.size).to eql(2)
      expect(subject.summary[0].cylinders).to eql(1500)
      expect(subject.summary[0].dasd.device_name).to eql("dasda")
      expect(subject.summary[1].cylinders).to eql(900)
      expect(subject.summary[1].dasd.device_name).to eql("dasdb")
    end
  end

  describe "#update_summary" do
    let(:process_output) { "0|1|0|\n1|0|0" }

    before do
      allow(subject).to receive(:read).and_return(process_output)
      allow(subject).to receive(:read_line).and_return(10_016, 500)
    end

    it "reads the output of the format process" do
      expect(subject).to receive(:read)
      subject.update_summary
    end

    it "parses the format process output creating a summary of the updated DASDs" do
      subject.initialize_summary
      expect(subject.summary[0]).to receive(:update_progress!).exactly(4).times
      expect(subject.summary[1]).to receive(:update_progress!).twice

      subject.update_summary
    end

    context "when there is nothing read" do
      it "returns nil" do
        expect(subject).to receive(:read).and_return(nil)
        expect(subject.update_summary).to eql(nil)
      end
    end
  end

  describe "#cylinders" do
    before do
      allow(subject).to receive(:read_line).and_return(10_016, 500)
    end

    it "returns the total number of cylinders to be formatted" do
      subject.initialize_summary
      expect(subject.cylinders).to eql(10_516)
    end
  end

  describe "#progress" do
    let(:process_output) { "0|1|0|\n1|0|0" }

    before do
      allow(subject).to receive(:read).and_return(process_output)
      allow(subject).to receive(:read_line).and_return(10_016, 500)
    end

    it "returns the total number of cylinders already formatted" do
      subject.initialize_summary
      expect(subject.progress).to eql(0)
      subject.update_summary
      expect(subject.progress).to eql(60)
    end
  end
end
