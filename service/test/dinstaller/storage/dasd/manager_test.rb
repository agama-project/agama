# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "dinstaller/storage/dasd/manager"
require "forwardable"

# Define some very basic (almost empty) Y2S390 classes to support the tests,
# since yast2-s390 is not available in all architectures so we cannot depend
# on the real definitions of these classes to run the tests.
module Y2S390
  class DasdsReader; end # rubocop:disable Lint/EmptyClass
  class FormatProcess; end # rubocop:disable Lint/EmptyClass

  class DasdsCollection
    extend Forwardable

    def_delegators :@elements, :each, :each_with_index, :select, :find, :reject, :map,
      :any?, :size, :empty?, :first

    # Constructor
    #
    # @param elements [Array<Objects>]
    def initialize(elements = [])
      @elements = elements
    end

    def all
      @elements.dup
    end
  end
end

describe DInstaller::Storage::DASD::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:reader) { double(Y2S390::DasdsReader) }
  before { expect(Y2S390::DasdsReader).to receive(:new).and_return(reader) }

  let(:dasds) { Y2S390::DasdsCollection.new([dasd1, dasd2, dasd3]) }
  let(:dasd1) { double("Y2S390::Dasd", id: "0.0.001", use_diag: true, diag_wanted: true) }
  let(:dasd2) { double("Y2S390::Dasd", id: "0.0.002", use_diag: false, diag_wanted: false) }
  let(:dasd3) { double("Y2S390::Dasd", id: "0.0.003", use_diag: false, diag_wanted: false) }

  describe "#probe" do
    before do
      allow(reader).to receive(:list).and_return dasds

      allow(dasd1).to receive(:diag_wanted=)
      allow(dasd2).to receive(:diag_wanted=)
      allow(dasd3).to receive(:diag_wanted=)
    end

    it "reads the list of DASDs from the system" do
      expect(reader).to receive(:list).with(force_probing: true).and_return dasds
      subject.probe
      expect(subject.devices).to eq dasds
    end

    it "ensures initial consistency of #use_diag and #diag_wanted" do
      expect(dasd1).to receive(:diag_wanted=).with(dasd1.use_diag)
      expect(dasd2).to receive(:diag_wanted=).with(dasd2.use_diag)
      expect(dasd3).to receive(:diag_wanted=).with(dasd3.use_diag)
      subject.probe
    end

    let(:callback) { proc {} }

    it "runs the probe callbacks" do
      subject.on_probe(&callback)
      expect(callback).to receive(:call).with(dasds)
      subject.probe
    end
  end

  describe "#enable" do
    let(:callback) { proc {} }
    let(:cheetah_error) { Cheetah::ExecutionFailed.new([], "", nil, nil) }

    before do
      allow(reader).to receive(:update_info)
    end

    it "calls dasd_configure for each given DASD with the 'online' argument set to 1" do
      expect(Yast::Execute).to receive(:locally!) do |cmd|
        expect(cmd.join(" ")).to match(/dasd_configure #{dasd1.id} 1/)
      end
      expect(Yast::Execute).to receive(:locally!) do |cmd|
        expect(cmd.join(" ")).to match(/dasd_configure #{dasd2.id} 1/)
      end
      expect(Yast::Execute).to receive(:locally!) do |cmd|
        expect(cmd.join(" ")).to match(/dasd_configure #{dasd3.id} 1/)
      end

      subject.enable(dasds)
    end

    it "returns true if none of the dasd_configure invocations fails" do
      expect(Yast::Execute).to receive(:locally!).exactly(dasds.size).times
      expect(subject.enable(dasds)).to eq true
    end

    it "returns false if any of the dasd_configure invocations fails" do
      expect(Yast::Execute).to receive(:locally!).with(array_including(dasd1.id), any_args)
      expect(Yast::Execute).to receive(:locally!).with(array_including(dasd2.id), any_args)
        .and_raise cheetah_error
      expect(Yast::Execute).to receive(:locally!).with(array_including(dasd3.id), any_args)
      expect(subject.enable(dasds)).to eq false
    end

    it "updates the information of the DASDs and runs the refresh callbacks" do
      allow(Yast::Execute).to receive(:locally!)
      subject.on_refresh(&callback)

      expect(reader).to receive(:update_info).with(dasd1, extended: true)
      expect(reader).to receive(:update_info).with(dasd2, extended: true)
      expect(reader).to receive(:update_info).with(dasd3, extended: true)
      expect(callback).to receive(:call).with(dasds)

      subject.enable(dasds)
    end
  end

  describe "#disable" do
    let(:callback) { proc {} }
    let(:cheetah_error) { Cheetah::ExecutionFailed.new([], "", nil, nil) }

    before { allow(reader).to receive(:update_info) }

    it "calls dasd_configure for each given DASD with the 'online' argument set to 0" do
      expect(Yast::Execute).to receive(:locally!).with(["dasd_configure", dasd1.id, "0"], any_args)
      expect(Yast::Execute).to receive(:locally!).with(["dasd_configure", dasd2.id, "0"], any_args)
      expect(Yast::Execute).to receive(:locally!).with(["dasd_configure", dasd3.id, "0"], any_args)

      subject.disable(dasds)
    end

    it "returns true if none of the dasd_configure invocations fails" do
      expect(Yast::Execute).to receive(:locally!).exactly(dasds.size).times
      expect(subject.disable(dasds)).to eq true
    end

    it "returns false if any of the dasd_configure invocations fails" do
      expect(Yast::Execute).to receive(:locally!).with(array_including(dasd1.id), any_args)
      expect(Yast::Execute).to receive(:locally!).with(array_including(dasd2.id), any_args)
        .and_raise cheetah_error
      expect(Yast::Execute).to receive(:locally!).with(array_including(dasd3.id), any_args)
      expect(subject.disable(dasds)).to eq false
    end

    it "updates the information of the DASDs and runs the refresh callbacks" do
      allow(Yast::Execute).to receive(:locally!)
      subject.on_refresh(&callback)

      expect(reader).to receive(:update_info).with(dasd1, extended: true)
      expect(reader).to receive(:update_info).with(dasd2, extended: true)
      expect(reader).to receive(:update_info).with(dasd3, extended: true)
      expect(callback).to receive(:call).with(dasds)

      subject.disable(dasds)
    end
  end

  describe "#format" do
    let(:callback) { proc {} }

    let(:fmt_status) { 0 }
    let(:fmt_process) do
      double("FmtProcess", start: true, status: fmt_status,
              initialize_summary: true, update_summary: true)
    end

    before do
      allow(reader).to receive(:update_info)
      allow(Y2S390::FormatProcess).to receive(:new).and_return fmt_process
      allow(fmt_process).to receive(:running?).and_return(true, true, true, false)
    end

    it "starts a FormatProcess with the given dasds" do
      expect(Y2S390::FormatProcess).to receive(:new).with(dasds)
      expect(fmt_process).to receive(:start)
      subject.format(dasds)
    end

    it "updates the information of the DASDs and runs the refresh callbacks" do
      subject.on_refresh(&callback)

      expect(reader).to receive(:update_info).with(dasd1, extended: true)
      expect(reader).to receive(:update_info).with(dasd2, extended: true)
      expect(reader).to receive(:update_info).with(dasd3, extended: true)
      expect(callback).to receive(:call).with(dasds)

      subject.format(dasds)
    end

    context "when the process is not running after 0.2 seconds of waiting" do
      before do
        allow(fmt_process).to receive(:running?).and_return(false)
      end

      it "returns false" do
        expect(subject.format(dasds)).to eq false
      end
    end

    context "if the process finishes with a status of 0" do
      let(:fmt_status) { 0 }

      it "returns true" do
        expect(subject.format(dasds)).to eq true
      end
    end

    context "if the process finishes with a non-zero status" do
      let(:fmt_status) { 1 }

      it "returns false" do
        expect(subject.format(dasds)).to eq false
      end
    end
  end

  describe "#set_diag" do
    let(:callback) { proc {} }

    let(:dasd1) do
      double("Y2S390::Dasd", id: "0.0.001", offline?: false, use_diag: true, diag_wanted: wanted)
    end
    let(:dasd2) do
      double("Y2S390::Dasd", id: "0.0.002", offline?: false, use_diag: false, diag_wanted: wanted)
    end
    let(:dasd3) do
      double("Y2S390::Dasd", id: "0.0.003", offline?: true, use_diag: false, diag_wanted: wanted)
    end

    let(:wanted) { true }

    before do
      allow(reader).to receive(:update_info)
      allow(dasd1).to receive(:diag_wanted=)
      allow(dasd2).to receive(:diag_wanted=)
      allow(dasd3).to receive(:diag_wanted=)
      allow(Yast::Execute).to receive(:locally!).with(array_including(dasd2.id), any_args)
    end

    context "for DASDs that are initially enabled" do
      it "disables the devices and enables it again if the value of use_diag has changed" do
        expect(Yast::Execute).to receive(:locally!)
          .with(["dasd_configure", dasd2.id, "0"], any_args).ordered
        expect(Yast::Execute).to receive(:locally!)
          .with(["dasd_configure", dasd2.id, "1", "1"], any_args).ordered

        subject.set_diag(dasds, wanted)
      end

      it "does nothing if the value of use_diag is the same than the current one" do
        expect(Yast::Execute).to_not receive(:locally!).with(array_including(dasd1.id), any_args)
        subject.set_diag(dasds, wanted)
      end
    end

    context "for DASDs that are initially disabled" do
      it "does not enable the device" do
        expect(Yast::Execute).to_not receive(:locally!).with(array_including(dasd3.id), any_args)
        subject.set_diag(dasds, wanted)
      end
    end

    it "updates the information of the DASDs and runs the refresh callbacks" do
      allow(Yast::Execute).to receive(:locally!)
      subject.on_refresh(&callback)

      expect(reader).to receive(:update_info).with(dasd1, extended: true)
      expect(reader).to receive(:update_info).with(dasd2, extended: true)
      expect(reader).to receive(:update_info).with(dasd3, extended: true)
      expect(callback).to receive(:call).with(dasds)

      subject.set_diag(dasds, wanted)
    end
  end
end
