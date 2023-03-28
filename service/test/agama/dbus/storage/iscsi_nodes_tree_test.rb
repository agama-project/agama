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
require "agama/dbus/storage/iscsi_nodes_tree"
require "agama/dbus/storage/iscsi_node"
require "agama/storage/iscsi/manager"
require "agama/storage/iscsi/node"
require "dbus"

describe Agama::DBus::Storage::ISCSINodesTree do
  subject { described_class.new(service, iscsi_manager, logger: logger) }

  let(:service) { instance_double(::DBus::Service) }

  let(:iscsi_manager) { Agama::Storage::ISCSI::Manager.new }

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(service).to receive(:get_node).with(described_class::ROOT_PATH, anything)
      .and_return(root_node)

    allow(root_node).to receive(:descendant_objects).and_return(dbus_nodes)
  end

  let(:root_node) { Agama::Storage::ISCSI::Node.new }

  let(:dbus_nodes) { [] }

  describe "#find" do
    let(:dbus_nodes) { [dbus_node1, dbus_node2] }

    let(:dbus_node1) do
      instance_double(::DBus::Object, path: "/org/opensuse/DInstaller/Storage1/iscsi_nodes/1")
    end

    let(:dbus_node2) do
      instance_double(::DBus::Object, path: "/org/opensuse/DInstaller/Storage1/iscsi_nodes/2")
    end

    context "when the given path is already exported on D-Bus" do
      let(:path) { "/org/opensuse/DInstaller/Storage1/iscsi_nodes/2" }

      it "returns the iSCSI D-Bus node exported with the given path" do
        expect(subject.find(path)).to eq(dbus_node2)
      end
    end

    context "when the given path is not exported on D-Bus yet" do
      let(:path) { "/org/opensuse/DInstaller/Storage1/iscsi_nodes/3" }

      it "returns nil" do
        expect(subject.find(path)).to be_nil
      end
    end
  end

  describe "#update" do
    let(:dbus_nodes) { [dbus_node1, dbus_node2] }

    let(:dbus_node1) do
      instance_double(Agama::DBus::Storage::ISCSINode, iscsi_node: node1)
    end

    let(:dbus_node2) do
      instance_double(Agama::DBus::Storage::ISCSINode, iscsi_node: node2)
    end

    let(:node1) do
      Agama::Storage::ISCSI::Node.new.tap do |node|
        node.address = "192.168.100.101"
        node.port = 3260
        node.target = "iqn.2023-01.com.example:12ac588"
        node.interface = "default"
      end
    end

    let(:node2) do
      Agama::Storage::ISCSI::Node.new.tap do |node|
        node.address = "192.168.100.102"
        node.port = 3260
        node.target = "iqn.2023-01.com.example:12ac588"
        node.interface = "default"
      end
    end

    before do
      allow(service).to receive(:export)
      allow(service).to receive(:unexport)
    end

    context "if a given iSCSI node is not exported yet" do
      let(:nodes) { [node3] }

      let(:node3) do
        Agama::Storage::ISCSI::Node.new.tap do |node|
          node.address = "192.168.100.103"
          node.port = 3260
          node.target = "iqn.2023-01.com.example:12ac588"
          node.interface = "default"
        end
      end

      it "exports a new D-Bus node" do
        expect(service).to receive(:export) do |dbus_node|
          expect(dbus_node.path).to match(/#{described_class::ROOT_PATH}\/[0-9]+/)
        end

        subject.update(nodes)
      end
    end

    context "if a given iSCSI node is already exported" do
      # This node is equal to node2
      let(:nodes) { [node3] }

      let(:node3) do
        Agama::Storage::ISCSI::Node.new.tap do |node|
          node.address = "192.168.100.102"
          node.port = 3260
          node.target = "iqn.2023-01.com.example:12ac588"
          node.interface = "default"
        end
      end

      it "updates the D-Bus node" do
        expect(dbus_node2).to receive(:iscsi_node=).with(node3)

        subject.update(nodes)
      end
    end

    context "if an exported D-Bus node does not represent any of the given iSCSI nodes" do
      # There is a D-Bus node for node2 but node2 is missing in the list of given nodes
      let(:nodes) { [node1] }

      before do
        allow(dbus_node1).to receive(:iscsi_node=)
      end

      it "unexports the D-Bus node" do
        expect(service).to receive(:unexport).with(dbus_node2)

        subject.update(nodes)
      end
    end
  end
end
