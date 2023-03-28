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

require "agama/dbus/with_path_generator"
require "agama/dbus/storage/iscsi_node"

module Agama
  module DBus
    module Storage
      # Class representing the iSCSI nodes tree exported on D-Bus
      class ISCSINodesTree
        include WithPathGenerator

        ROOT_PATH = "/org/opensuse/Agama/Storage1/iscsi_nodes"
        path_generator ROOT_PATH

        # Constructor
        #
        # @param service [::DBus::Service]
        # @param iscsi_manager Agama::Storage::ISCSI::Manager]
        # @param logger [Logger, nil]
        def initialize(service, iscsi_manager, logger: nil)
          @service = service
          @iscsi_manager = iscsi_manager
          @logger = logger
        end

        # Finds an iSCSI D-Bus node exported with the given path
        #
        # @param path [::DBus::ObjectPath]
        def find(path)
          dbus_nodes.find { |n| n.path == path }
        end

        # Updates the D-Bus tree according to the given iSCSI nodes
        #
        # New nodes are exported, existing nodes are updated and missing nodes are unexported.
        #
        # @param iscsi_nodes [Array<Agama::Storage::ISCSI::Node>]
        def update(iscsi_nodes)
          add_new_nodes(iscsi_nodes)
          update_existing_nodes(iscsi_nodes)
          delete_old_nodes(iscsi_nodes)
        end

      private

        # @return [::DBus::Service]
        attr_reader :service

        # @return [Agama::Storage::ISCSI::Manager]
        attr_reader :iscsi_manager

        # @return [Logger]
        attr_reader :logger

        # Exports a new iSCSI D-Bus node for the given iSCSI nodes which do not have a D-Bus object
        #
        # @param iscsi_nodes [Array<Agama::Storage::ISCSI::Node>]
        def add_new_nodes(iscsi_nodes)
          new_iscsi_nodes = iscsi_nodes.select { |n| find_node(n).nil? }
          new_iscsi_nodes.each { |n| add_node(n) }
        end

        # Updates the D-Bus iSCSI node for the given iSCSI nodes that already have a D-Bus object
        #
        # @param iscsi_nodes [Array<Agama::Storage::ISCSI::Node>]
        def update_existing_nodes(iscsi_nodes)
          existing_iscsi_nodes = iscsi_nodes.reject { |n| find_node(n).nil? }
          existing_iscsi_nodes.each { |n| update_node(n) }
        end

        # Unexports the D-Bus iSCSI nodes that do not represent any of the given iSCSI nodes
        #
        # @param iscsi_nodes [Array<Agama::Storage::ISCSI::Node>]
        def delete_old_nodes(iscsi_nodes)
          current_iscsi_nodes = dbus_nodes.map(&:iscsi_node)
          deleted_iscsi_nodes = current_iscsi_nodes.select do |current_node|
            iscsi_nodes.none? { |n| same_iscsi_node?(n, current_node) }
          end

          deleted_iscsi_nodes.each { |n| delete_node(n) }
        end

        # Exports a D-Bus node for the given iSCSI node
        #
        # @param iscsi_node [Agama::Storage::ISCSI::Node]
        def add_node(iscsi_node)
          dbus_node = DBus::Storage::ISCSINode.new(
            iscsi_manager, iscsi_node, next_path, logger: logger
          )
          service.export(dbus_node)
          dbus_node.path
        end

        # Updates the D-Bus node associated to the given iSCSI node
        #
        # @param iscsi_node [Agama::Storage::ISCSI::Node]
        def update_node(iscsi_node)
          dbus_node = find_node(iscsi_node)
          dbus_node.iscsi_node = iscsi_node
        end

        # Unexports the D-Bus node associated to the given iSCSI node
        #
        # @param iscsi_node [Agama::Storage::ISCSI::Node]
        def delete_node(iscsi_node)
          dbus_node = find_node(iscsi_node)
          service.unexport(dbus_node)
        end

        # Returns the D-Bus node associated to the given iSCSI node
        #
        # @param iscsi_node [Agama::Storage::ISCSI::Node]
        # @return [Agama::DBus::Storage::ISCSINode]
        def find_node(iscsi_node)
          dbus_nodes.find { |n| same_iscsi_node?(n.iscsi_node, iscsi_node) }
        end

        # All exported iSCSI D-Bus nodes
        #
        # @return [Array<Agama::DBus::Storage::ISCSINode>]
        def dbus_nodes
          root = service.get_node(ROOT_PATH, create: false)
          return [] unless root

          root.descendant_objects
        end

        # Whether the given iSCSI nodes can be considered the same iSCSI node
        #
        # @param iscsi_node1 [Agama::Storage::ISCSI::Node]
        # @param iscsi_node2 [Agama::Storage::ISCSI::Node]
        #
        # @return [Boolean]
        def same_iscsi_node?(iscsi_node1, iscsi_node2)
          [:address, :port, :target, :interface].all? do |method|
            iscsi_node1.public_send(method) == iscsi_node2.public_send(method)
          end
        end
      end
    end
  end
end
