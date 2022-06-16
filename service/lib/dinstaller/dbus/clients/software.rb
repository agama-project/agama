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
    module Clients
      # D-Bus client for software configuration
      class Software
        def initialize
          @dbus_object = service.object("/org/opensuse/DInstaller/Software1")
          @dbus_object.introspect
        end

        # Available products for the installation
        #
        # @return [Array<Array<String, String>>] name and display name of each product
        def available_products
          dbus_object["org.opensuse.DInstaller.Software1"]["AvailableBaseProducts"].map do |l|
            l[0..1]
          end
        end

        # Product selected to install
        #
        # @return [String] name of the product
        def selected_product
          dbus_object["org.opensuse.DInstaller.Software1"]["SelectedBaseProduct"]
        end

        # Selects the product to install
        #
        # @param name [String]
        def select_product(name)
          dbus_object.SelectProduct(name)
        end

        # Starts the probing process
        def probe(&block)
          return dbus_object.Probe unless block_given?

          dbus_object.Probe(&block)
        end

        def install
          dbus_object.Install
        end

        def propose
          dbus_object.Propose
        end

        def finish
          dbus_object.Finish
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_object

        # @return [::DBus::Service]
        def service
          @service ||= bus.service("org.opensuse.DInstaller.Software")
        end

        def bus
          @bus ||= ::DBus::SystemBus.instance
        end
      end
    end
  end
end
