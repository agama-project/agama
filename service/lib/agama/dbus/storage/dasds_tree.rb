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
require "agama/dbus/storage/dasd"

module DInstaller
  module DBus
    module Storage
      # Class representing the tree of DASDs exported on D-Bus
      class DasdsTree
        include WithPathGenerator

        # Root of the tree
        ROOT_PATH = "/org/opensuse/DInstaller/Storage1/dasds"
        path_generator ROOT_PATH

        # Constructor
        #
        # @param service [::DBus::Service]
        # @param logger [Logger, nil]
        def initialize(service, logger: nil)
          @service = service
          @logger = logger
        end

        # Fills the D-Bus tree with the given DASDs
        #
        # Any previous DASD is unexported and the new ones are exported
        #
        # @param dasds [Array<DBus::Storage::Dasd>]
        def populate(dasds)
          delete_missing(dasds)
          update(dasds)
        end

        # Updates the information of the given DASDs in the D-Bus tree
        #
        # @param dasds [Array<DBus::Storage::Dasd>]
        def update(dasds)
          dasds.each { |dasd| publish(dasd) }
        end

        # Finds in the tree the DASDs objects corresponding to the given paths
        #
        # Paths not corresponding to any DASD are simply ignored.
        #
        # @param paths [Array<String>]
        # @return [Array<DBus::Storage::Dasd>]
        def find_paths(paths)
          dbus_dasds.find_all { |d| paths.include?(d.path) }
        end

        # @return [Array<DBus::Storage::Dasd>]
        def find(*args, &block)
          dbus_dasds.find(*args, &block)
        end

      private

        # @return [::DBus::Service]
        attr_reader :service

        # @return [Logger]
        attr_reader :logger

        # All exported DASDs
        #
        # @return [Array<DBus::Storage::Dasd>]
        def dbus_dasds
          root = service.get_node(ROOT_PATH, create: false)
          return [] unless root

          root.descendant_objects
        end

        # @see #populate
        def delete_missing(dasds)
          missing_dbus_dasds(dasds).each do |dbus_dasd|
            service.unexport(dbus_dasd)
          end
        end

        # @see #delete_missing
        def missing_dbus_dasds(dasds)
          wanted_ids = dasds.map(&:id)
          dbus_dasds.reject { |d| wanted_ids.include?(d.id) }
        end

        # Exports or updates the information of a given DASD object
        #
        # @return [DBus::Storage::Dasd]
        def publish(dasd)
          dbus_dasd = dbus_dasds.find { |d| d.id == dasd.id }

          if dbus_dasd
            dbus_dasd.dasd = dasd
          else
            dbus_dasd = DBus::Storage::Dasd.new(dasd, next_path, logger: logger)
            service.export(dbus_dasd)
          end
        end
      end
    end
  end
end
