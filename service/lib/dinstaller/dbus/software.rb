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
    # D-Bus object to manage software installation
    class Software < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Software1"
      private_constant :PATH

      SOFTWARE_INTERFACE = "org.opensuse.DInstaller.Software1"
      private_constant :SOFTWARE_INTERFACE

      # Constructor
      #
      # @param backend [DInstaller::Software]
      # @param logger [Logger]
      def initialize(backend, logger)
        @backend = backend
        @logger = logger

        super(PATH)
      end

      dbus_interface SOFTWARE_INTERFACE do
        dbus_reader :available_base_products, "a(ssa{sv})"
        attr_writer :available_base_products

        dbus_watcher :available_base_products

        dbus_reader :selected_base_product, "s"

        dbus_method :SelectProduct, "in ProductID:s" do |product_id|
          logger.info "SelectProduct #{product_id}"

          select_product(product_id)
          dbus_properties_changed(SOFTWARE_INTERFACE, { "SelectedBaseProduct" => product_id }, [])
        end
      end

      def available_base_products
        backend.products.map do |id, data|
          [id, data["name"], { "description" => data["description"] }].freeze
        end
      end

      def selected_base_product
        backend.product
      end

      def select_product(product_id)
        backend.select_product(product_id)
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [DInstaller::Software]
      attr_reader :backend
    end
  end
end
