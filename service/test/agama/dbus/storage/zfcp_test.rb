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
require "agama/dbus/storage/zfcp"
require "agama/storage/zfcp/manager"
require "json"

RSpec.describe Agama::DBus::Storage::ZFCP do
  subject { described_class.new(manager) }

  let(:manager) { instance_double(Agama::Storage::ZFCP::Manager) }

  let(:config_json) do
    {
      devices: [
        {
          channel: "0.0.7000",
          wwpn:    "0x500507630303c5f9",
          lun:     "0x5022000000000000"
        }
      ]
    }
  end

  before do
    allow(subject).to receive(:SystemChanged)
    allow(subject).to receive(:ProgressChanged)
    allow(subject).to receive(:ProgressFinished)
    allow(manager).to receive(:config_json).and_return(config_json)
    allow(manager).to receive(:probe)
    allow(manager).to receive(:configure)
  end

  describe "#recover_system" do
    before do
      allow(manager).to receive(:probed?).and_return(true)
      allow(manager).to receive(:allow_lun_scan?).and_return(true)
      allow(manager).to receive(:controllers).and_return([controller])
      allow(manager).to receive(:devices).and_return([device])
    end

    let(:controller) do
      instance_double(
        Agama::Storage::ZFCP::Controller,
        channel:   "0.0.7000",
        wwpns:     ["0x500507630303c5f9"],
        lun_scan?: true,
        active?:   true
      )
    end

    let(:device) do
      instance_double(
        Agama::Storage::ZFCP::Device,
        channel:     "0.0.7000",
        wwpn:        "0x500507630303c5f9",
        lun:         "0x5022000000000000",
        active?:     true,
        device_name: "/dev/sda"
      )
    end

    let(:system_json) do
      {
        lunScan:     true,
        controllers: [
          {
            channel: "0.0.7000",
            wwpns:   ["0x500507630303c5f9"],
            lunScan: true,
            active:  true
          }
        ],
        devices:     [
          {
            channel:    "0.0.7000",
            wwpn:       "0x500507630303c5f9",
            lun:        "0x5022000000000000",
            active:     true,
            deviceName: "/dev/sda"
          }
        ]
      }
    end

    it "returns the system information as a JSON" do
      expected_value = JSON.pretty_generate(system_json)
      expect(manager).to_not receive(:probe)
      expect(subject.recover_system).to eq(expected_value)
    end

    context "when not probed yet" do
      before do
        allow(manager).to receive(:probed?).and_return(false)
      end

      it "probes the system first" do
        expect(manager).to receive(:probe)
        subject.recover_system
      end
    end
  end

  describe "#recover_config" do
    it "returns the config as a JSON" do
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

  describe "#probe" do
    before do
      allow(subject).to receive(:recover_system)
    end

    it "probes the manager and emits signals" do
      expect(subject).to receive(:ProgressChanged).ordered
      expect(manager).to receive(:probe)
      expect(subject).to receive(:ProgressChanged).ordered
      expect(subject).to receive(:SystemChanged).ordered
      expect(subject).to receive(:ProgressFinished).ordered
      subject.probe
    end

    it "configures with the current config" do
      expect(manager).to receive(:configure).with(config_json)
      subject.probe
    end

    context "if there is no config" do
      let(:config_json) { nil }

      it "does not configure" do
        expect(manager).not_to receive(:configure)
        subject.probe
      end
    end
  end

  describe "#configure" do
    before do
      allow(subject).to receive(:recover_system).and_return("")
      allow(manager).to receive(:configure)
    end

    let(:config_json) do
      {
        devices: []
      }
    end

    let(:new_config_json) do
      {
        devices: [
          {
            channel: "0.0.7000",
            wwpn:    "0x500507630303c5f9",
            lun:     "0x5022000000000000"
          }
        ]
      }
    end

    it "configures zFCP and emits signals" do
      expect(subject).to receive(:ProgressChanged).ordered
      expect(manager).to receive(:configure).with(new_config_json).ordered
      expect(subject).to receive(:ProgressFinished).ordered
      subject.configure(JSON.generate(new_config_json))
    end

    context "when system changed" do
      before do
        allow(manager).to receive(:configure).and_return(true)
      end

      it "emits a system changed signal" do
        expect(subject).to receive(:SystemChanged)
        subject.configure(JSON.generate(new_config_json))
      end
    end

    context "when system has not changed" do
      before do
        allow(manager).to receive(:configure).and_return(false)
      end

      it "does not emit a system changed signal" do
        expect(subject).not_to receive(:SystemChanged)
        subject.configure(JSON.generate(new_config_json))
      end
    end

    context "when the given config is the same as the current one" do
      it "does not configure" do
        expect(manager).not_to receive(:configure)
        expect(subject).not_to receive(:ProgressChanged)
        expect(subject).not_to receive(:ProgressFinished)
        expect(subject).not_to receive(:SystemChanged)
        subject.configure(JSON.generate(config_json))
      end
    end

    context "when the given config is 'null'" do
      let(:new_config_json) { nil }

      it "does not configure" do
        expect(manager).not_to receive(:configure)
        expect(subject).not_to receive(:ProgressChanged)
        expect(subject).not_to receive(:ProgressFinished)
        subject.configure(JSON.generate(new_config_json))
      end
    end
  end
end
