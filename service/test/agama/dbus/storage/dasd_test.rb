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
require "agama/dbus/storage/dasd"
require "agama/storage/dasd/manager"
require "json"

RSpec.describe Agama::DBus::Storage::DASD do
  subject { described_class.new(manager) }

  let(:manager) { instance_double(Agama::Storage::DASD::Manager) }

  before do
    allow(manager).to receive(:on_format_change)
    allow(manager).to receive(:on_format_finish)
  end

  describe "#probe" do
    before do
      allow(subject).to receive(:recover_system).and_return("{}")
    end
    it "probes for devices" do
      expect(subject).to receive(:ProgressChanged).ordered
      expect(manager).to receive(:probe).ordered
      expect(subject).to receive(:SystemChanged).with("{}").ordered
      expect(subject).to receive(:ProgressFinished).ordered
      subject.probe
    end
  end

  describe "#recover_system" do
    before do
      allow(manager).to receive(:devices).and_return([dasd])
      allow(manager).to receive(:device_type).with(dasd).and_return("ECKD")
    end

    let(:dasd) do
      double("Y2S390::Dasd",
        id:             "0.0.0100",
        device_name:    "dasda",
        use_diag:       false,
        access_type:    "diag",
        partition_info: "1",
        status:         :active,
        offline?:       false,
        formatted?:     true)
    end

    let(:system_json) do
      {
        devices: [
          {
            channel:       "0.0.0100",
            deviceName:    "dasda",
            type:          "ECKD",
            diag:          false,
            accessType:    "diag",
            partitionInfo: "1",
            status:        "active",
            active:        true,
            formatted:     true
          }
        ]
      }
    end

    context "when already probed" do
      before do
        allow(manager).to receive(:probed?).and_return(true)
      end

      it "returns system information as JSON" do
        expected_value = JSON.pretty_generate(system_json)
        expect(manager).to_not receive(:probe)
        expect(subject.recover_system).to eq(expected_value)
      end
    end

    context "when not probed yet" do
      before do
        allow(manager).to receive(:probed?).and_return(false)
      end

      it "probes first" do
        expected_value = JSON.pretty_generate(system_json)
        expect(manager).to receive(:probe)
        expect(subject.recover_system).to eq(expected_value)
      end
    end
  end

  describe "#recover_config" do
    before do
      allow(manager).to receive(:config_json).and_return(config_json)
    end

    let(:config_json) do
      {
        devices: [
          { channel: "0.0.0100", active: true }
        ]
      }
    end

    it "returns the config as JSON" do
      expected_value = JSON.pretty_generate(config_json)
      expect(subject.recover_config).to eq(expected_value)
    end

    context "if there is not config yet" do
      let(:config_json) { nil }

      it "returns 'null'" do
        expect(subject.recover_config).to eq("null")
      end
    end
  end

  describe "#configure" do
    let(:config_json) do
      {
        devices: [
          { channel: "0.0.0100", active: true }
        ]
      }
    end

    let(:serialized_config) { JSON.generate(config_json) }

    context "with no config" do
      it "does nothing" do
        expect(manager).not_to receive(:configure)
        subject.configure("null")
      end
    end

    context "when config has not changed" do
      before do
        allow(manager).to receive(:configured?).with(config_json).and_return(true)
      end

      it "does nothing" do
        expect(manager).not_to receive(:configure)
        subject.configure(serialized_config)
      end
    end

    context "when config has changed" do
      before do
        allow(manager).to receive(:configured?).with(config_json).and_return(false)
        allow(subject).to receive(:recover_system).and_return("{}")
      end

      it "performs configuration in a thread" do
        expect(Thread).to receive(:new).and_yield
        expect(subject).to receive(:SystemChanged)
        expect(subject).to receive(:ProgressChanged)
        expect(subject).to receive(:ProgressFinished)
        expect(manager).to receive(:configure).with(config_json)

        subject.configure(serialized_config)
      end
    end

    context "when already configuring" do
      let(:thread) { instance_double(Thread, alive?: true) }

      before do
        allow(manager).to receive(:configured?).with(config_json).and_return(false)
        subject.instance_variable_set(:@configuration_thread, thread)
      end

      it "raises an error" do
        expect { subject.configure(serialized_config) }
          .to raise_error(RuntimeError, "Previous configuration is not finished yet")
      end
    end
  end

  describe "format callbacks" do
    let(:format_status) do
      double(
        "Y2S390::FormatStatus",
        dasd:      double("Y2S390::Dasd", id: "0.0.0100"),
        cylinders: 100,
        progress:  10,
        done?:     false
      )
    end

    it "emits FormatChanged signal on manager format change" do
      format_cb = nil
      allow(manager).to receive(:on_format_change) { |&block| format_cb = block }

      summary_json = [
        {
          channel:            "0.0.0100",
          totalCylinders:     100,
          FormattedCylinders: 10,
          finished:           false
        }
      ]

      expect(subject).to receive(:FormatChanged).with(JSON.pretty_generate(summary_json))
      format_cb.call([format_status])
    end

    it "emits FormatFinished signal on manager format finish" do
      finish_cb = nil
      allow(manager).to receive(:on_format_finish) { |&block| finish_cb = block }

      expect(subject).to receive(:FormatFinished).with("success")
      finish_cb.call("success")
    end
  end
end
