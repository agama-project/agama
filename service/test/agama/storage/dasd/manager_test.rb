# frozen_string_literal: true

# Copyright (c) [2023-2026] SUSE LLC
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
require "agama/storage/dasd/manager"
require "agama/storage/dasd/config"
require "agama/storage/dasd/configs/device"
require "agama/storage/dasd/config_importer"
require "agama/storage/dasd/enable_operation"
require "agama/storage/dasd/disable_operation"
require "agama/storage/dasd/format_operation"
require "agama/storage/dasd/diag_operation"
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

describe Agama::Storage::DASD::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { instance_double(Logger, info: nil) }

  before do
    allow(Y2S390::DasdsReader).to receive(:new).and_return(reader)
    allow(reader).to receive(:list).with(force_probing: true).and_return(devices_collection)
  end

  let(:reader) { double("Y2S390::DasdsReader") }
  let(:devices_collection) { Y2S390::DasdsCollection.new(devices) }
  let(:devices) { [] }

  describe "#probe" do
    let(:dasd1) do
      double("Y2S390::Dasd", id: "0.0.0100", use_diag: true, status: "online", offline?: false)
    end

    let(:dasd2) do
      double("Y2S390::Dasd", id: "0.0.0101", use_diag: false, status: "offline", offline?: true)
    end

    let(:devices) { [dasd1, dasd2] }

    before do
      allow(dasd1).to receive(:diag_wanted=)
      allow(dasd2).to receive(:diag_wanted=)
    end

    it "sets probed? to true" do
      subject.probe
      expect(subject).to be_probed
    end

    it "reads devices from the system" do
      subject.probe
      expect(subject.devices).to eq(devices_collection)
    end

    it "ensures initial consistency of #use_diag and #diag_wanted" do
      expect(dasd1).to receive(:diag_wanted=).with(true)
      expect(dasd2).to receive(:diag_wanted=).with(false)
      subject.probe
    end

    it "locks devices that are not offline" do
      subject.probe
      expect(subject.send(:device_locked?, dasd1)).to be(true)
      expect(subject.send(:device_locked?, dasd2)).to be(false)
    end
  end

  describe "#configured?" do
    let(:config_json) { { devices: [] } }

    it "returns false if not configured yet" do
      expect(subject.configured?(config_json)).to be(false)
    end

    context "when configured" do
      before do
        subject.instance_variable_set(:@configured, true)
        subject.instance_variable_set(:@config_json, config_json)
      end

      it "returns true for the same config" do
        expect(subject.configured?(config_json)).to be(true)
      end

      it "returns false if the system was probed again" do
        subject.probe
        expect(subject.configured?(config_json)).to be(false)
      end

      it "returns false for a different config" do
        expect(subject.configured?({})).to be(false)
      end
    end
  end

  describe "#configure" do
    let(:dasd1) do
      double("Y2S390::Dasd",
        id:         "0.0.0001",
        status:     :offline,
        formatted?: false,
        use_diag:   false,
        active?:    false,
        offline?:   true)
    end

    let(:dasd2) do
      double("Y2S390::Dasd",
        id:         "0.0.0002",
        status:     :offline,
        formatted?: false,
        use_diag:   false,
        active?:    false,
        offline?:   true)
    end

    let(:dasd3) do
      double("Y2S390::Dasd",
        id:         "0.0.0003",
        status:     :offline,
        formatted?: false,
        use_diag:   false,
        active?:    false,
        offline?:   true)

    end

    let(:dasd4) do
      double("Y2S390::Dasd",
        id:         "0.0.0004",
        status:     :offline,
        formatted?: false,
        use_diag:   false,
        active?:    false,
        offline?:   true)
    end

    let(:devices) { [dasd1, dasd2, dasd3, dasd4] }

    let(:config_json) { {} }

    before do
      devices.each { |d| allow(d).to receive(:diag_wanted=) }
      allow(reader).to receive(:update_info)
      allow(subject).to receive(:device_locked?).and_return(false)

      # Mock all operations
      allow(Agama::Storage::DASD::EnableOperation).to receive(:new).and_return(enable_operation)
      allow(Agama::Storage::DASD::DisableOperation).to receive(:new).and_return(disable_operation)
      allow(Agama::Storage::DASD::FormatOperation).to receive(:new).and_return(format_operation)
      allow(Agama::Storage::DASD::DiagOperation).to receive(:new).and_return(diag_operation)
    end

    let(:enable_operation) { instance_double(Agama::Storage::DASD::EnableOperation, run: nil) }
    let(:disable_operation) { instance_double(Agama::Storage::DASD::DisableOperation, run: nil) }
    let(:format_operation) { instance_double(Agama::Storage::DASD::FormatOperation, run: nil) }
    let(:diag_operation) { instance_double(Agama::Storage::DASD::DiagOperation, run: nil) }

    context "if not probed yet" do
      before do
        allow(subject).to receive(:probed?).and_return(false)
      end

      it "calls probe" do
        expect(subject).to receive(:probe)
        subject.configure(config_json)
      end
    end

    context "if already probed" do
      before do
        allow(subject).to receive(:probed?).and_return(true)
      end

      it "does not call probe" do
        expect(subject).to_not receive(:probe)
        subject.configure(config_json)
      end
    end

    context "if the config activates devices" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0001",
              state:   "active"
            },
            {
              channel: "0.0.0002",
              state:   "active"
            },
            {
              channel: "0.0.0003",
              state:   "active"
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:active?).and_return(false)
        allow(dasd2).to receive(:active?).and_return(false)
        allow(dasd3).to receive(:active?).and_return(true)
        allow(dasd4).to receive(:active?).and_return(false)
      end

      it "activates the device if not active yet" do
        expect(Agama::Storage::DASD::EnableOperation).to receive(:new) do |devices, _|
          expect(devices).to contain_exactly(dasd1, dasd2)
          enable_operation
        end
        subject.configure(config_json)
      end
    end

    context "if the config deactivates devices" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0001",
              state:   "offline"
            },
            {
              channel: "0.0.0002",
              state:   "active"
            },
            {
              channel: "0.0.0003",
              state:   "offline"
            },
            {
              channel: "0.0.0004",
              state:   "offline"
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:active?).and_return(true)
        allow(dasd2).to receive(:active?).and_return(false)
        allow(dasd3).to receive(:active?).and_return(true)
        allow(dasd4).to receive(:active?).and_return(false)
      end

      it "deactivates the device if active" do
        expect(Agama::Storage::DASD::DisableOperation).to receive(:new) do |devices, _|
          expect(devices).to contain_exactly(dasd1, dasd3)
          disable_operation
        end
        subject.configure(config_json)
      end
    end

    context "if the config does not include a device" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0002",
              state:   "active"
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:active?).and_return(true)
        allow(dasd2).to receive(:active?).and_return(false)
        allow(dasd3).to receive(:active?).and_return(true)
        allow(dasd4).to receive(:active?).and_return(false)
      end

      it "deactivates the unlisted device if active" do
        expect(Agama::Storage::DASD::DisableOperation).to receive(:new) do |devices, _|
          expect(devices).to contain_exactly(dasd1, dasd3)
          disable_operation
        end
        subject.configure(config_json)
      end

      context "and some unlisted device is locked" do
        before do
          allow(subject).to receive(:device_locked?).with(dasd1).and_return(true)
        end

        it "does not deactivate the locked devices" do
          expect(Agama::Storage::DASD::DisableOperation).to receive(:new) do |devices, _|
            expect(devices).to contain_exactly(dasd3)
            disable_operation
          end
          subject.configure(config_json)
        end
      end
    end

    context "if the config formats a device" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0001",
              state:   "active",
              format:  true
            },
            {
              channel: "0.0.0002",
              state:   "active",
              format:  true
            },
            {
              channel: "0.0.0003",
              state:   "offline",
              format:  true
            },
            {
              channel: "0.0.0004",
              state:   "active",
              format:  false
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:formatted?).and_return(false)
        allow(dasd2).to receive(:formatted?).and_return(true)
        allow(dasd3).to receive(:formatted?).and_return(false)
        allow(dasd4).to receive(:formatted?).and_return(true)
      end

      it "formats the device if configured as active" do
        expect(Agama::Storage::DASD::FormatOperation).to receive(:new) do |devices, _, _|
          expect(devices).to contain_exactly(dasd1, dasd2)
          format_operation
        end
        subject.configure(config_json)
      end
    end

    context "if the config omits format" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0001",
              state:   "active"
            },
            {
              channel: "0.0.0002",
              state:   "active"
            },
            {
              channel: "0.0.0003",
              state:   "offline"
            },
            {
              channel: "0.0.0004",
              state:   "active"
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:formatted?).and_return(true)
        allow(dasd2).to receive(:formatted?).and_return(false)
        allow(dasd3).to receive(:formatted?).and_return(false)
        allow(dasd4).to receive(:formatted?).and_return(false)
      end

      it "formats the device if configured as active and not formatted yet" do
        expect(Agama::Storage::DASD::FormatOperation).to receive(:new) do |devices, _, _|
          expect(devices).to contain_exactly(dasd2, dasd4)
          format_operation
        end
        subject.configure(config_json)
      end
    end

    context "if the config enables DIAG" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0001",
              state:   "active",
              diag:    true
            },
            {
              channel: "0.0.0002",
              state:   "active",
              diag:    true
            },
            {
              channel: "0.0.0003",
              state:   "offline",
              diag:    true
            },
            {
              channel: "0.0.0004",
              state:   "active"
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:use_diag).and_return(true)
        allow(dasd2).to receive(:use_diag).and_return(false)
        allow(dasd3).to receive(:use_diag).and_return(false)
        allow(dasd4).to receive(:use_diag).and_return(true)
      end

      # TODO
      it "enables DIAG if configured as active and not enabled yet" do
        expect(Agama::Storage::DASD::DiagOperation)
          .to receive(:new).with([dasd2], logger, true).and_return(diag_operation)
        subject.configure(config_json)
      end
    end

    context "if the config disables DIAG" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0001",
              state:   "active",
              diag:    false
            },
            {
              channel: "0.0.0002",
              state:   "active",
              diag:    false
            },
            {
              channel: "0.0.0003",
              state:   "offline",
              diag:    false
            },
            {
              channel: "0.0.0004",
              state:   "active"
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:use_diag).and_return(false)
        allow(dasd2).to receive(:use_diag).and_return(true)
        allow(dasd3).to receive(:use_diag).and_return(true)
        allow(dasd4).to receive(:use_diag).and_return(false)
      end

      it "disables DIAG if configured as active and not disabled yet" do
        expect(Agama::Storage::DASD::DiagOperation)
          .to receive(:new).with([dasd2], logger, false).and_return(diag_operation)
        subject.configure(config_json)
      end
    end

    context "if a device was modified" do
      let(:config_json) do
        {
          devices: [
            {
              channel: "0.0.0001",
              state:   "active",
              format:  false
            },
            {
              channel: "0.0.0002",
              state:   "active",
              format:  false,
              diag:    true
            },
            {
              channel: "0.0.0003",
              state:   "active",
              format:  true
            },
            {
              channel: "0.0.0004",
              state:   "active",
              format:  false
            }
          ]
        }
      end

      before do
        allow(dasd1).to receive(:active?).and_return(false)
        allow(dasd2).to receive(:active?).and_return(true)
        allow(dasd2).to receive(:use_diag).and_return(false)
        allow(dasd3).to receive(:active?).and_return(true)
        allow(dasd4).to receive(:active?).and_return(true)
        allow(subject).to receive(:device_locked?).and_call_original
      end

      it "refreshes all modified devices" do
        expect(reader).to receive(:update_info).with(dasd1, extended: true)
        expect(reader).to receive(:update_info).with(dasd2, extended: true)
        expect(reader).to receive(:update_info).with(dasd3, extended: true)
        expect(reader).to_not receive(:update_info).with(dasd4, extended: true)
        subject.configure(config_json)
      end

      it "unlocks modified devices" do
        locked_ids = [dasd1.id, dasd2.id, dasd3.id, dasd4.id]
        subject.instance_variable_set(:@locked_devices, locked_ids)
        subject.configure(config_json)
        expect(subject.send(:device_locked?, dasd1)).to eq(false)
        expect(subject.send(:device_locked?, dasd2)).to eq(false)
        expect(subject.send(:device_locked?, dasd3)).to eq(false)
        expect(subject.send(:device_locked?, dasd4)).to eq(true)
      end
    end
  end

  describe "#device_type" do
    let(:dasd) { double("Y2S390::Dasd", id: "0.0.0100") }

    it "returns type if already known" do
      allow(dasd).to receive(:type).and_return("FOO")
      expect(subject.device_type(dasd)).to eq("FOO")
    end

    {
      "3990/E9 3390/0A"  => "ECKD",
      "2105/E20 3390/03" => "ECKD",
      "6310/C01"         => "FBA",
      "3880/01 3370/02"  => "FBA",
      "3880/03 3390/02"  => "ECKD",
      "BEEF/01"          => "BEEF/01"
    }.each do |device_type, expected|
      it "returns '#{expected}' for device_type '#{device_type}'" do
        allow(dasd).to receive(:type).and_return(nil)
        allow(dasd).to receive(:device_type).and_return(device_type)
        expect(subject.device_type(dasd)).to eq(expected)
      end
    end
  end
end
