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
require "dinstaller/dbus/base_object"
require "dinstaller/dbus/with_service_status"
require "dinstaller/dbus/clients/language"
require "dinstaller/dbus/interfaces/progress"
require "dinstaller/dbus/interfaces/service_status"

module DInstaller
  module DBus
    module Software
      # D-Bus object to manage software installation
      class Manager < BaseObject
        include WithServiceStatus
        include Interfaces::Progress
        include Interfaces::ServiceStatus

        PATH = "/org/opensuse/DInstaller/Software1"
        private_constant :PATH

        # Constructor
        #
        # @param backend [DInstaller::Software]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
          register_callbacks
          register_progress_callbacks
          register_service_status_callbacks
        end

        SOFTWARE_INTERFACE = "org.opensuse.DInstaller.Software1"
        private_constant :SOFTWARE_INTERFACE

        dbus_interface SOFTWARE_INTERFACE do
          dbus_reader :available_base_products, "a(ssa{sv})"

          dbus_reader :selected_base_product, "s"

          dbus_method :SelectProduct, "in ProductID:s" do |product_id|
            logger.info "SelectProduct #{product_id}"

            select_product(product_id)
            dbus_properties_changed(SOFTWARE_INTERFACE, { "SelectedBaseProduct" => product_id }, [])
          end

          # TODO: just for performance comparison (see `perf.rb`)
          dbus_method :ProvisionSelected, "in Provision:s, out Result:b" do |provision|
            backend.provision_selected?(provision)
          end

          dbus_method :ProvisionsSelected, "in Provisions:as, out Result:ab" do |provisions|
            [provisions.map { |p| backend.provision_selected?(p) }]
          end

          dbus_method(:Probe) { probe }
          dbus_method(:Propose) { propose }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }

          dbus_method(:TestingQuestion) { backend.testing_question }
        end

        def available_base_products
          backend.products.map do |id, data|
            [id, data["name"], { "description" => data["description"] }].freeze
          end
        end

        # Returns the selected base product
        #
        # @return [String] Product ID or an empty string if no product is selected
        def selected_base_product
          backend.product || ""
        end

        def select_product(product_id)
          backend.select_product(product_id)
        end

        def probe
          busy_while { backend.probe }
        end

        def propose
          busy_while { backend.propose }
        end

        def install
          busy_while { backend.install }
        end

        def finish
          busy_while { backend.finish }
        end

      private

        # @return [DInstaller::Software]
        attr_reader :backend

        # Registers callback to be called
        def register_callbacks
          client = DInstaller::DBus::Clients::Language.new
          client.on_language_selected do |language_ids|
            backend.languages = language_ids
          end
        end
      end
    end
  end
end
