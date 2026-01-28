# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "agama/storage/iscsi/adapter"
require "agama/storage/iscsi/initiator"
require "agama/storage/iscsi/node"
require "agama/storage/iscsi/manager"

describe Agama::Storage::ISCSI::Manager do
  subject { described_class.new(logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:adapter) { Agama::Storage::ISCSI::Adapter.new }

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

  let(:node3) do
    Agama::Storage::ISCSI::Node.new.tap do |target|
      target.target = "iqn.2023-01.com.example:12123"
      target.address = "192.168.100.110"
      target.port = 3264
      target.interface = "default"
      target.ibft = false
      target.startup = "manual"
      target.connected = true
      target.locked = false
    end
  end

  before do
    allow(subject).to receive(:adapter).and_return(adapter)
    allow(subject).to receive(:sleep)
    allow(adapter).to receive(:read_initiator)
    allow(adapter).to receive(:read_nodes)
    allow(adapter).to receive(:update_initiator)
    allow(adapter).to receive(:discover)
    allow(adapter).to receive(:discover_from_portals)
    allow(adapter).to receive(:login).and_return(true)
    allow(adapter).to receive(:logout).and_return(true)
    allow(adapter).to receive(:update_node)
  end

  describe "#probe" do
    before do
      allow(adapter).to receive(:read_initiator).and_return(initiator)
      allow(adapter).to receive(:read_nodes).and_return([node1, node2, node3])
    end

    it "reads the initiator" do
      subject.probe
      expect(subject.initiator).to eq(initiator)
    end

    it "reads the discoverd nodes" do
      subject.probe
      nodes = subject.nodes
      expect(nodes).to contain_exactly(node1, node2, node3)
    end

    it "sets the system as probed" do
      expect(subject.probed?).to eq(false)
      subject.probe
      expect(subject.probed?).to eq(true)
    end

    context "on first probe" do
      before do
        [node1, node2, node3].each { |n| n.locked = false }
      end

      it "locks connected nodes" do
        subject.probe
        expect(node1.locked?).to eq(true)
        expect(node2.locked?).to eq(false)
        expect(node3.locked?).to eq(true)
      end
    end

    context "on other probes" do
      before do
        allow(adapter).to receive(:read_nodes).and_return([node1, node2], [node1, node2, node3])
        [node1, node2, node3].each { |n| n.locked = false }
      end

      it "only locks initially connected nodes" do
        subject.probe
        subject.probe
        expect(node1.locked?).to eq(true)
        expect(node2.locked?).to eq(false)
        expect(node3.locked?).to eq(false)
      end
    end
  end

  describe "#discover" do
    it "performs iSCSI discovery without credentials" do
      expect(adapter).to receive(:discover) do |host, port, options|
        expect(host).to eq("192.168.100.101")
        expect(port).to eq(3264)
        expect(options).to eq({ credentials: {} })
      end
      expect(subject).to receive(:probe)
      subject.discover("192.168.100.101", 3264)
    end

    it "performs iSCSI discovery with credentials" do
      credentials = {
        username:           "target",
        password:           "12345",
        initiator_username: "initiator",
        initiator_password: "54321"
      }
      expect(adapter).to receive(:discover) do |host, port, options|
        expect(host).to eq("192.168.100.101")
        expect(port).to eq(3264)
        expect(options).to eq({ credentials: credentials })
      end
      expect(subject).to receive(:probe)
      subject.discover("192.168.100.101", 3264, credentials: credentials)
    end
  end

  describe "#configure" do
    before do
      allow(adapter).to receive(:read_initiator).and_return(initiator)
      allow(adapter).to receive(:read_nodes).and_return([node1, node2, node3])
    end

    context "if the config does not specify the initiator name" do
      it "does not update the initiator" do
        expect(adapter).to_not receive(:update_initiator)
        subject.configure({})
      end
    end

    context "if the config specifies the initiator name" do
      let(:config_json) { { initiator: initiator_name } }

      context "and the name is equal to the current inititator name" do
        let(:initiator_name) { "iqn.1996-04.de.suse:01:351e6d6249" }

        it "does not update the initiator" do
          expect(adapter).to_not receive(:update_initiator)
          subject.configure(config_json)
        end
      end

      context "and the name is not equal to the current inititator name" do
        let(:initiator_name) { "iqn.1996-04.de.suse:01:351e6d6250" }

        it "updates the initiator" do
          expect(adapter).to receive(:update_initiator).with(initiator, name: initiator_name)
          subject.configure(config_json)
        end
      end
    end

    context "if the config does not specify targets" do
      let(:config_json) { {} }

      it "does not connect any node" do
        expect(adapter).to_not receive(:login)
        subject.configure(config_json)
      end

      it "does not disconnect any node" do
        expect(adapter).to_not receive(:logout)
        subject.configure(config_json)
      end
    end

    context "if the config specifies targets" do
      let(:config_json) { { targets: targets } }

      context "and the list is empty" do
        let(:targets) { [] }

        before do
          node1.locked = true
          node1.connected = true

          node2.locked = false
          node2.connected = false

          node3.locked = false
          node3.connected = true

          allow(subject).to receive(:probe_nodes)
          allow(subject).to receive(:nodes).and_return([node1, node2, node3])
        end

        it "disconnects the connected nodes if unlocked" do
          expect(adapter).to_not receive(:logout).with(node1)
          expect(adapter).to_not receive(:logout).with(node2)
          expect(adapter).to receive(:logout).with(node3)
          subject.configure(config_json)
        end

        it "does not connect any node" do
          expect(adapter).to_not receive(:login)
          subject.configure(config_json)
        end
      end

      context "and the list is not empty" do
        let(:targets) do
          [
            {
              address:   "192.168.100.151",
              port:      3260,
              name:      "iqn.2025-01.com.example:becda24e8804c6580bd0",
              interface: "default"
            },
            {
              address:   "192.168.100.152",
              port:      3260,
              name:      "iqn.2025-01.com.example:becda24e8804c6580bd1",
              interface: "default"
            }
          ]
        end

        it "performs a discovery for each portal" do
          expect(adapter).to receive(:discover_from_portal)
            .with("192.168.100.151:3260", interfaces: ["default"])

          expect(adapter).to receive(:discover_from_portal)
            .with("192.168.100.152:3260", interfaces: ["default"])

          subject.configure(config_json)
        end

        context "if the node is disconnected" do
          let(:targets) do
            [
              {
                name:      "iqn.2023-01.com.example:12aca",
                address:   "192.168.100.110",
                port:      3260,
                interface: "default"
              }
            ]
          end

          it "connects the node" do
            expect(adapter).to receive(:login).with(node2, anything)
            subject.configure(config_json)
          end
        end

        context "if the node is connected" do
          let(:targets) do
            [
              {
                name:         "iqn.2023-01.com.example:12ac588",
                address:      "192.168.100.102",
                port:         3260,
                interface:    "default",
                startup:      startup,
                authByTarget: auth
              }
            ]
          end

          let(:startup) { nil }

          context "and its credentials have changed" do
            let(:auth) do
              {
                username: "test",
                password: "12345"
              }
            end

            it "reconnects the node" do
              expect(adapter).to receive(:logout).with(node1).ordered
              expect(adapter).to receive(:login).with(node1, anything).ordered
              subject.configure(config_json)
            end
          end

          context "and its credentials have not changed" do
            let(:auth) { nil }

            context "and its startup mode has changed" do
              let(:startup) { "manual" }

              it "updates the node" do
                expect(adapter).to receive(:update_node).with(node1, { startup: "manual" })
                subject.configure(config_json)
              end
            end

            context "and its startup mode has not changed" do
              let(:startup) { "onboot" }

              it "does not change the node" do
                expect(adapter).to_not receive(:logout).with(node1)
                expect(adapter).to_not receive(:login).with(node1)
                expect(adapter).to_not receive(:update_node).with(node1)
                subject.configure(config_json)
              end
            end
          end
        end
      end
    end

    context "if the system has not changed" do
      before do
        allow(adapter).to receive(:read_initiator).and_return(initiator, initiator)
        allow(adapter).to receive(:read_nodes).and_return([node1], [node1])
      end

      it "returns false" do
        expect(subject.configure({})).to eq(false)
      end
    end

    context "if the initiator has changed" do
      before do
        new_initiator = initiator.dup.tap { |i| i.name = "iqn.1996-04.de.suse:01:351e6d62aa" }
        allow(adapter).to receive(:read_initiator).and_return(initiator, new_initiator)
        allow(adapter).to receive(:read_nodes).and_return([node1], [node1])
      end

      it "returns true" do
        expect(subject.configure({})).to eq(true)
      end
    end

    context "if the nodes have changed" do
      before do
        allow(adapter).to receive(:read_nodes).and_return([node1], [node1, node2])
      end

      it "returns true" do
        expect(subject.configure({})).to eq(true)
      end
    end
  end

  describe "#configured?" do
    before do
      allow(subject).to receive(:previous_config).and_return(previous_config)
      allow(subject).to receive(:initiator).and_return(initiator)
      allow(subject).to receive(:nodes).and_return(nodes)
    end

    let(:previous_config) { Agama::Storage::ISCSI::ConfigImporter.new(previous_config_json).import }

    let(:previous_config_json) do
      {
        initiator: "iqn.1996-04.de.suse:01:351e6d6249",
        targets:   [
          {
            address:         "192.168.100.110",
            port:            3260,
            name:            "iqn.2023-01.com.example:12123",
            interface:       "default",
            startup:         "manual",
            authByTarget:    {
              username: "target",
              password: "12345"
            },
            authByInitiator: {
              username: "ini",
              password: "54321"
            }
          }
        ]
      }
    end

    let(:nodes) { [node1, node2, node3] }

    context "if the initiator and the nodes are already configured" do
      let(:config_json) { previous_config_json.dup }

      it "returns true" do
        expect(subject.configured?(config_json)).to eq(true)
      end
    end

    context "if there is no initiator in the system" do
      let(:initiator) { nil }

      context "and the given config has no initiator" do
        let(:config_json) do
          {
            targets: previous_config_json[:targets]
          }
        end

        it "returns true" do
          expect(subject.configured?(config_json)).to eq(true)
        end
      end

      context "and the given config has initiator" do
        let(:config_json) { previous_config_json.dup }

        it "returns false" do
          expect(subject.configured?(config_json)).to eq(false)
        end
      end
    end

    context "if the given config contains a target that is not connected" do
      let(:config_json) do
        {
          initiator: previous_config_json[:initiator],
          targets:   [
            {
              address:   "192.168.100.110",
              port:      3260,
              name:      "iqn.2023-01.com.example:12aca",
              interface: "default",
              startup:   "manual"
            }
          ]
        }
      end

      it "returns false" do
        expect(subject.configured?(config_json)).to eq(false)
      end
    end

    context "if the given config is missing a target that is connected" do
      let(:config_json) do
        {
          initiator: previous_config_json[:initiator],
          targets:   []
        }
      end

      it "returns false" do
        expect(subject.configured?(config_json)).to eq(false)
      end
    end

    context "if the given config contains a configured target" do
      let(:config_json) do
        {
          initiator: previous_config_json[:initiator],
          targets:   [target]
        }
      end

      context "and the credentials have changed" do
        let(:target) do
          {
            address:         "192.168.100.110",
            port:            3260,
            name:            "iqn.2023-01.com.example:12123",
            interface:       "default",
            startup:         "manual",
            authByTarget:    {
              username: "target",
              password: "123456"
            },
            authByInitiator: {
              username: "ini",
              password: "54321"
            }
          }
        end

        it "returns false" do
          expect(subject.configured?(config_json)).to eq(false)
        end
      end

      context "and the startup have changed" do
        let(:target) do
          {
            address:         "192.168.100.110",
            port:            3260,
            name:            "iqn.2023-01.com.example:12123",
            interface:       "default",
            startup:         "onboot",
            authByTarget:    {
              username: "target",
              password: "12345"
            },
            authByInitiator: {
              username: "ini",
              password: "54321"
            }
          }
        end

        it "returns false" do
          expect(subject.configured?(config_json)).to eq(false)
        end
      end
    end
  end
end
