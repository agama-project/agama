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
require "agama/dbus/storage/fcoe_interface"

module Agama
  module DBus
    module Storage
      # Class representing the FCoE interfaces tree exported on D-Bus
      class FcoeInterfacesTree
        include WithPathGenerator

        ROOT_PATH = "/org/opensuse/Agama/Storage1/fcoe_interfaces"
        path_generator ROOT_PATH

        # Constructor
        #
        # @param service [::DBus::Service]
        # @param fcoe_manager Agama::Storage::Fcoe::Manager]
        # @param logger [Logger, nil]
        def initialize(service, fcoe_manager, logger: nil)
          @service = service
          @fcoe_manager = fcoe_manager
          @logger = logger
        end

        # Updates the D-Bus tree according to the given FCoE interface objects
        #
        # The current D-Bus nodes are all unexported.
        #
        # @param ifaces [Array<Agama::Storage::Fcoe::Interface>]
        def update(ifaces)
          unexport_interfaces
          ifaces.each { |i| export_object(i) }
        end

      private

        # @return [::DBus::Service]
        attr_reader :service

        # @return [Agama::Storage::Fcoe::Manager]
        attr_reader :fcoe_manager

        # @return [Logger]
        attr_reader :logger

        # Unexports the currently exported D-Bus objects
        def unexport_interfaces
          dbus_objects.each { |o| service.unexport(o) }
        end

        # Exports a D-Bus node for the given FCoE Interface
        #
        # @param iscsi_node [Agama::Storage::Fcoe::Interface]
        def add_object(iface)
          dbus_object = DBus::Storage::FcoeInterface.new(
            fcoe_manager, iface, next_path, logger: logger
          )
          service.export(dbus_object)
        end

        # All exported D-Bus objects
        #
        # @return [Array<Agama::DBus::Storage::FcoeInterface>]
        def dbus_objects
          root = service.get_node(ROOT_PATH, create: false)
          return [] unless root

          root.descendant_objects
        end
      end
    end
  end
end
