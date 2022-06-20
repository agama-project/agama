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
        TYPES = [:package, :pattern].freeze
        private_constant :TYPES

        def initialize
          @dbus_object = service.object("/org/opensuse/DInstaller/Software1")
          @dbus_object.introspect

          @dbus_proposal = service.object("/org/opensuse/DInstaller/Software/Proposal1")
          @dbus_proposal.introspect
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
        #
        # If a block is given, the method returns inmmediatelly and the probing is performed in an
        # asynchronous way.
        #
        # @param done [Proc] Block to execute once the probing is done
        def probe(&done)
          dbus_object.Probe(&done)
        end

        # Performs the packages installation
        def install
          dbus_object.Install
        end

        # Makes the software proposal
        def propose
          dbus_object.Propose
        end

        # Finishes the software installation
        def finish
          dbus_object.Finish
        end

        # Add the given list of resolvables to the packages proposal
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @param resolvables [Array<String>] Resolvables to add
        def add_resolvables(unique_id, type, resolvables, optional: false)
          dbus_proposal.AddResolvables(unique_id, TYPES.index(type), resolvables, optional)
        end

        # Returns a list of resolvables
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @return [Array<String>] Resolvables
        def get_resolvables(unique_id, type, optional: false)
          dbus_proposal.GetResolvables(unique_id, TYPES.index(type), optional).first
        end

        # Replace a list of resolvables in the packages proposal
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @param resolvables [Array<String>] List of resolvables
        def set_resolvables(unique_id, type, resolvables, optional: false)
          dbus_proposal.SetResolvables(unique_id, TYPES.index(type), resolvables, optional)
        end

        # Remove resolvables from a list
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @param resolvables [Array<String>] Resolvables to remove
        def remove_resolvables(unique_id, type, resolvables, optional: false)
          dbus_proposal.RemoveResolvables(unique_id, TYPES.index(type), resolvables, optional)
        end

        # Determines whether a package is available
        #
        # @param name [String] Package name
        # @return [Boolean] true if the package is available; false otherwise
        # @see Yast::Package#Available
        def package_available?(name)
          dbus_object.IsPackageAvailable(name)
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_proposal

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
