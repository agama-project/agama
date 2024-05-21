# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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

require "agama/dbus/clients/base"
require "agama/dbus/clients/with_issues"
require "agama/dbus/clients/with_progress"
require "agama/dbus/clients/with_service_status"

module Agama
  module DBus
    module Clients
      # D-Bus client for software configuration
      class Software < Base
        include WithIssues
        include WithProgress
        include WithServiceStatus

        TYPES = [:package, :pattern].freeze
        private_constant :TYPES

        # @note This client is singleton because ruby-dbus does not work properly with several
        #   instances of the same client.
        def self.instance
          @instance ||= new
        end

        # @return [String]
        def service_name
          @service_name ||= "org.opensuse.Agama.Software1"
        end

        # Available products for the installation
        #
        # @return [Array<Array<String, String>>] name and display name of each product
        def available_products
          dbus_product["org.opensuse.Agama.Software1.Product"]["AvailableProducts"].map do |l|
            l[0..1]
          end
        end

        # Product selected to install
        #
        # @return [String, nil] name of the product
        def selected_product
          product = dbus_product["org.opensuse.Agama.Software1.Product"]["SelectedProduct"]
          return nil if product.empty?

          product
        end

        # Selects the product to install
        #
        # @param name [String]
        def select_product(name)
          dbus_product.SelectProduct(name)
        end

        # Starts the probing process
        #
        # If a block is given, the method returns immediately and the probing is performed in an
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

        # Determine whether the given tags are provided by the selected packages
        #
        # @param tags [Array<String>] Tags to search for (package names, requires/provides, or file
        #   names)
        # @return [Array<Boolean>] An array containing whether each tag is selected or not
        def provisions_selected?(tags)
          dbus_object.ProvisionsSelected(tags)
        end

        # Determines whether a package is installed.
        #
        # @param name [String] Package name.
        # @return [Boolean]
        def package_installed?(name)
          dbus_object.IsPackageInstalled(name)
        end

        # Determines whether a package is available.
        #
        # @param name [String] Package name.
        # @return [Boolean]
        def package_available?(name)
          dbus_object.IsPackageAvailable(name)
        end

        # Add the given list of resolvables to the packages proposal
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @param resolvables [Array<String>] Resolvables to add
        # @param [Boolean] optional True for optional list, false (the default) for
        #   the required list
        def add_resolvables(unique_id, type, resolvables, optional: false)
          dbus_proposal.AddResolvables(unique_id, TYPES.index(type), resolvables, optional)
        end

        # Returns a list of resolvables
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @param [Boolean] optional True for optional list, false (the default) for
        #   the required list
        # @return [Array<String>] Resolvables
        def get_resolvables(unique_id, type, optional: false)
          dbus_proposal.GetResolvables(unique_id, TYPES.index(type), optional).first
        end

        # Replace a list of resolvables in the packages proposal
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @param resolvables [Array<String>] List of resolvables
        # @param [Boolean] optional True for optional list, false (the default) for
        #   the required list
        def set_resolvables(unique_id, type, resolvables, optional: false)
          dbus_proposal.SetResolvables(unique_id, TYPES.index(type), resolvables, optional)
        end

        # Remove resolvables from a list
        #
        # @param unique_id [String] Unique identifier for the resolvables list
        # @param type [Symbol] Resolvables type (:package or :pattern)
        # @param resolvables [Array<String>] Resolvables to remove
        # @param [Boolean] optional True for optional list, false (the default) for
        #   the required list
        def remove_resolvables(unique_id, type, resolvables, optional: false)
          dbus_proposal.RemoveResolvables(unique_id, TYPES.index(type), resolvables, optional)
        end

        # Registers a callback to run when the product changes
        #
        # @param block [Proc] Callback to run when a product is selected
        def on_product_selected(&block)
          on_properties_change(dbus_product) do |_, changes, _|
            product = changes["SelectedProduct"]
            block.call(product) unless product.nil?
          end
        end

        # Registers a callback to run when the software is probed.
        #
        # @param block [Proc]
        def on_probe_finished(&block)
          subscribe(dbus_object, "org.opensuse.Agama.Software1", "ProbeFinished", &block)
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_object

        # @return [::DBus::Object]
        attr_reader :dbus_product

        # @return [::DBus::Object]
        attr_reader :dbus_proposal

        def initialize
          super

          @dbus_object = service["/org/opensuse/Agama/Software1"]
          @dbus_object.introspect

          @dbus_product = service["/org/opensuse/Agama/Software1/Product"]
          @dbus_product.introspect

          @dbus_proposal = service["/org/opensuse/Agama/Software1/Proposal"]
          @dbus_proposal.introspect
        end
      end
    end
  end
end
