# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "dbus"

module DInstaller
  module DBus
    module Storage
      # D-Bus object to get the list of storage actions to perform in the system
      class Actions < ::DBus::Object
        PATH = "/org/opensuse/DInstaller/Storage/Actions1"
        private_constant :PATH

        INTERFACE = "org.opensuse.DInstaller.Storage.Actions1"
        private_constant :INTERFACE

        # Constructor
        #
        # @param backend [DInstaller::Storage::Actions]
        # @param logger [Logger]
        def initialize(backend, logger)
          @logger = logger
          @backend = backend

          super(PATH)

          backend.add_on_change_listener do
            PropertiesChanged(INTERFACE, { "All" => all }, [])
          end
        end

        dbus_interface INTERFACE do
          # All actions
          dbus_reader :all, "aa{sv}"
        end

        # List of sorted actions in D-Bus format
        #
        # @see #to_dbus
        #
        # @return [Array<Hash>]
        def all
          backend.all.map { |a| to_dbus(a) }
        end

      private

        # @return [DInstaller::Storage::Actions]
        attr_reader :backend

        # Converts an action to D-Bus format
        #
        # @param action [Y2Storage::CompoundAction]
        # @return [Hash]
        def to_dbus(action)
          {
            "Text"   => action.sentence,
            "Subvol" => action.device_is?(:btrfs_subvolume),
            "Delete" => action.delete?
          }
        end
      end
    end
  end
end
