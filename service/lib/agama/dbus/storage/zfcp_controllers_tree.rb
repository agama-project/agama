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

require "agama/dbus/base_tree"
require "agama/dbus/with_path_generator"
require "agama/dbus/storage/zfcp_controller"

module Agama
  module DBus
    module Storage
      # Tree of zFCP controllers exported on D-Bus
      class ZFCPControllersTree < BaseTree
        include WithPathGenerator

        ROOT_PATH = "/org/opensuse/Agama/Storage1/zfcp_controllers"
        path_generator ROOT_PATH

        # Constructor
        #
        # @param service [::DBus::ObjectServer]
        # @param zfcp_manager [Agama::Storage::ZFCP::Manager]
        # @param logger [Logger, nil]
        def initialize(service, zfcp_manager, logger: nil)
          super(service, ROOT_PATH, logger: logger)

          @zfcp_manager = zfcp_manager
        end

      private

        # @return [Agama::Storage::ZFCP::Manager]
        attr_reader :zfcp_manager

        # @see BaseTree#create_dbus_object
        #
        # @param object [Agama::Storage::ZFCP::Controller]
        # @return [ZFCPController]
        def create_dbus_object(object)
          ZFCPController.new(zfcp_manager, object, next_path, logger: logger)
        end

        # @see BaseTree#update_dbus_object
        #
        # @param dbus_object [ZFCPController]
        # @param object [Agama::Storage::ZFCP::Controller]
        def update_dbus_object(dbus_object, object)
          dbus_object.controller = object
        end

        # @see BaseTree#dbus_object?
        #
        # @param dbus_object [ZFCPController]
        # @param object [Agama::Storage::ZFCP::Controller]
        def dbus_object?(dbus_object, object)
          dbus_object.controller.channel == object.channel
        end
      end
    end
  end
end
