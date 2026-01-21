# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "agama/dbus/storage/iscsi"
require "agama/storage/iscsi/node"
require "agama/storage/iscsi/initiator"
require "agama/storage/iscsi/manager"

def serialize(value)
  JSON.pretty_generate(value)
end

def parse(string)
  JSON.parse(string, symbolize_names: true)
end

describe Agama::DBus::Storage::ISCSI do
  subject { described_class.new(manager, logger: logger) }

  let(:manager) { Agama::Storage::ISCSI::Manager.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:initiator) do
    Agama::Storage::ISCSI::Initiator.new.tap do |initiator|
      initiator.name = "iqn.1996-04.de.suse:01:351e6d6249"
      initiator.ibft_name = true
    end
  end

  let(:node1) do
    Agama::Storage::ISCSI::Node.new.tap do |target|
      target.target = "iqn.2023-01.com.example:12ac588"
      target.address = "192.168.100.102"
      target.port = 3264
      target.interface = "default"
      target.ibft = true
      target.startup = "onboot"
      target.connected = true
      target.locked = true
    end
  end

  let(:node2) do
    Agama::Storage::ISCSI::Node.new.tap do |target|
      target.target = "iqn.2023-01.com.example:12aca"
      target.address = "192.168.100.110"
      target.port = 3264
      target.interface = "default"
      target.ibft = false
      target.startup = "manual"
      target.connected = false
      target.locked = false
    end
  end

  describe "#recover_system" do
    before do
      allow(manager).to receive(:initiator).and_return(initiator)
    end

    context "if the system is not probed yet" do
      before do
        allow(manager).to receive(:probed?).and_return(false)
      end

      it "probes the system" do
        expect(manager).to receive(:probe)
        subject.recover_system
      end
    end

    context "if the system is already probed" do
      before do
        allow(manager).to receive(:probed?).and_return(true)
      end

      it "does not probe the system" do
        expect(manager).to_not receive(:probe)
        subject.recover_system
      end
    end

    describe "#recover_system[:initiator]" do
      it "returns a hash with the intitiator info" do
        result = parse(subject.recover_system)[:initiator]
        expect(result).to eq({
          name: "iqn.1996-04.de.suse:01:351e6d6249",
          ibft: true
        })
      end
    end

    describe "#recover_system[:targets]" do
      context "if there are not nodes" do
        before do
          allow(manager).to receive(:nodes).and_return([])
        end

        it "returns an empty list" do
          result = parse(subject.recover_system)[:targets]
          expect(result).to eq([])
        end
      end

      context "if there are nodes" do
        before do
          allow(manager).to receive(:nodes).and_return([node1, node2])
        end

        it "returns a list with a hash for each node" do
          result = parse(subject.recover_system)[:targets]
          expect(result).to eq(
            [
              {
                name:      "iqn.2023-01.com.example:12ac588",
                address:   "192.168.100.102",
                port:      3264,
                interface: "default",
                ibft:      true,
                startup:   "onboot",
                connected: true,
                locked:    true
              },
              {
                name:      "iqn.2023-01.com.example:12aca",
                address:   "192.168.100.110",
                port:      3264,
                interface: "default",
                ibft:      false,
                startup:   "manual",
                connected: false,
                locked:    false
              }
            ]
          )
        end
      end
    end
  end

  describe "#recover_config" do
    context "if the config has not been set" do
      before do
        expect(manager).to receive(:config_json).and_return(nil)
      end

      it "returns 'null'" do
        expect(subject.recover_config).to eq("null")
      end
    end

    context "if the config has been set" do
      before do
        expect(manager).to receive(:config_json).and_return(config_json)
      end

      let(:config_json) do
        {
          initiator: "iqn.1996-04.de.suse:01:351e6d6249",
          targets:   [
            {
              address:   "192.168.100.151",
              port:      3260,
              name:      "iqn.2025-01.com.example:becda24e8804c6580bd0",
              interface: "default"
            }
          ]
        }
      end

      it "returns a hash with the config" do
        result = parse(subject.recover_config)
        expect(result).to eq(config_json)
      end
    end
  end

  describe "#configure" do
    before do
      allow(subject).to receive(:SystemChanged)
      allow(subject).to receive(:ProgressChanged)
      allow(subject).to receive(:ProgressFinished)
    end

    let(:config_json) do
      {
        initiator: "iqn.1996-04.de.suse:01:351e6d6249",
        targets:   [
          {
            address:   "192.168.100.151",
            port:      3260,
            name:      "iqn.2025-01.com.example:becda24e8804c6580bd0",
            interface: "default"
          }
        ]
      }
    end

    it "configures iSCSI" do
      expect(subject).to receive(:SystemChanged)
      expect(subject).to receive(:ProgressChanged)
      expect(subject).to receive(:ProgressFinished)
      expect(manager).to receive(:configure).with(config_json)
      subject.configure(serialize(config_json))
    end
  end

  describe "#discover" do
    before do
      allow(subject).to receive(:SystemChanged)
      allow(subject).to receive(:ProgressChanged)
      allow(subject).to receive(:ProgressFinished)
    end

    let(:options_json) do
      {
        address:           "192.168.100.151",
        port:              3260,
        username:          "target",
        password:          "12345",
        initiatorUsername: "initiator",
        initiatorPassword: "54321"
      }
    end

    it "performs iSCSI discovery" do
      expect(subject).to receive(:SystemChanged)
      expect(subject).to receive(:ProgressChanged)
      expect(subject).to receive(:ProgressFinished)
      expect(manager).to receive(:discover) do |address, port, credentials:|
        expect(address).to eq("192.168.100.151")
        expect(port).to eq(3260)
        expect(credentials).to eq({
          username:           "target",
          password:           "12345",
          initiator_username: "initiator",
          initiator_password: "54321"
        })
      end

      subject.discover(serialize(options_json))
    end

    context "if discovery successes" do
      before do
        allow(manager).to receive(:discover).and_return(true)
      end

      it "returns 0" do
        result = subject.discover(serialize(options_json))
        expect(result).to eq(0)
      end
    end

    context "if discovery fails" do
      before do
        allow(manager).to receive(:discover).and_return(false)
      end

      it "returns 1" do
        result = subject.discover(serialize(options_json))
        expect(result).to eq(1)
      end
    end
  end
end
