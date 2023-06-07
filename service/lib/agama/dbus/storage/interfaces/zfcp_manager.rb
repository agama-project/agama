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

require "agama/dbus/storage/zfcp_controllers_tree"
require "agama/dbus/storage/zfcp_disks_tree"
require "agama/storage/zfcp/manager"

module Agama
  module DBus
    module Storage
      module Interfaces
        # Mixin to define the D-Bus interface to manage zFCP devices
        #
        # @note This mixin is expected to be included by {Agama::DBus::Storage::Manager}.
        module ZFCPManager
          # Registers callbacks to update the collection of zFCP controllers, the disks and
          # deprecate the system
          def register_zfcp_callbacks
            zfcp_backend.on_probe do |controllers, disks|
              zfcp_controllers_tree.objects = controllers
              zfcp_disks_tree.objects = disks
            end

            zfcp_backend.on_disks_change do |_|
              deprecate_system
            end
          end

          # D-Bus tree representing a collection of zFCP controllers
          #
          # @return [Storage::ZFCPControllersTree]
          def zfcp_controllers_tree
            @zfcp_controllers_tree ||= Storage::ZFCPControllersTree.new(
              @service, zfcp_backend, logger: logger
            )
          end

          # D-Bus tree representing a collection of zFCP disks
          #
          # @return [Storage::ZFCPDisksTree]
          def zfcp_disks_tree
            @zfcp_disks_tree ||= Storage::ZFCPDisksTree.new(@service, logger: logger)
          end

          # @return [Storage::ZFCP::Manager]
          def zfcp_backend
            @zfcp_backend ||= Agama::Storage::ZFCP::Manager.new(logger: logger)
          end

          ZFCP_MANAGER_INTERFACE = "org.opensuse.Agama.Storage1.ZFCP.Manager"
          private_constant :ZFCP_MANAGER_INTERFACE

          def self.included(base)
            base.class_eval do
              dbus_interface ZFCP_MANAGER_INTERFACE do
                # Probes the zFCP controllers and disks
                dbus_method(:Probe, "out result:u") do
                  busy_while { zfcp_backend.probe }
                  0
                end
              end
            end
          end
        end
      end
    end
  end
end
