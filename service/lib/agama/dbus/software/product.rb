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

require "dbus"
require "suse/connect"
require "agama/dbus/base_object"
require "agama/dbus/interfaces/issues"
require "agama/dbus/clients/locale"
require "agama/registration"

module Agama
  module DBus
    module Software
      # D-Bus object to manage product configuration.
      class Product < BaseObject
        include Interfaces::Issues

        PATH = "/org/opensuse/Agama/Software1/Product"
        private_constant :PATH

        # @param backend [Agama::Software::Manager]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
          @logger = logger
          register_callbacks
        end

        # List of issues, see {DBus::Interfaces::Issues}.
        #
        # @return [Array<Agama::Issue>]
        def issues
          backend.product_issues
        end

        def available_products
          backend.products.map do |product|
            [
              product.id,
              product.display_name,
              {
                "description" => product.localized_description,
                "icon"        => product.icon
              }
            ]
          end
        end

        # Returns the selected base product.
        #
        # @return [String] Product ID or an empty string if no product is selected
        def selected_product
          backend.product&.id || ""
        end

        # Selects a product.
        #
        # @param id [String] Product id.
        # @return [Array(Integer, String)] Result code and a description.
        #   Possible result codes:
        #   0: success
        #   1: already selected
        #   2: deregister first
        #   3: unknown product
        def select_product(id)
          if backend.product&.id == id
            [1, "Product is already selected"]
          elsif backend.registration.reg_code
            [2, "Current product must be deregistered first"]
          else
            backend.select_product(id)
            [0, ""]
          end
        rescue ArgumentError
          [3, "Unknown product"]
        end

        PRODUCT_INTERFACE = "org.opensuse.Agama.Software1.Product"
        private_constant :PRODUCT_INTERFACE

        dbus_interface PRODUCT_INTERFACE do
          dbus_method :AvailableProducts, "out result:a(ssa{sv})" do
            [available_products]
          end

          dbus_reader :selected_product, "s"

          dbus_method :SelectProduct, "in id:s, out result:(us)" do |id|
            logger.info "Selecting product #{id}"

            code, description = select_product(id)

            if code == 0
              dbus_properties_changed(PRODUCT_INTERFACE, { "SelectedProduct" => id }, [])
              dbus_properties_changed(REGISTRATION_INTERFACE, { "Requirement" => requirement }, [])
              # FIXME: Product issues might change after selecting a product. Nevertheless,
              #   #on_issues_change callbacks should be used for emitting issues signals, ensuring
              #   they are emitted every time the backend changes its issues. Currently,
              #   #on_issues_change cannot be used for product issues. Note that Software::Manager
              #   backend takes care of both software and product issues. And it already uses
              #   #on_issues_change callbacks for software related issues.
              issues_properties_changed
            end

            [[code, description]]
          end
        end

        def reg_code
          backend.registration.reg_code || ""
        end

        def email
          backend.registration.email || ""
        end

        # Registration requirement.
        #
        # @return [Integer] Possible values:
        #   0: not required
        #   1: optional
        #   2: mandatory
        def requirement
          case backend.registration.requirement
          when Agama::Registration::Requirement::MANDATORY
            2
          when Agama::Registration::Requirement::OPTIONAL
            1
          else
            0
          end
        end

        # Tries to register with the given registration code.
        #
        # @note Software is not automatically probed after registering the product. The reason is
        #   to avoid dealing with possible probing issues in the registration D-Bus API. Clients
        #   have to explicitly call to #Probe after registering a product.
        #
        # @param reg_code [String]
        # @param email [String, nil]
        #
        # @return [Array(Integer, String)] Result code and a description.
        #   Possible result codes:
        #   0: success
        #   1: missing product
        #   2: already registered
        #   3: registration not required
        #   4: network error
        #   5: timeout error
        #   6: api error
        #   7: missing credentials
        #   8: incorrect credentials
        #   9: invalid certificate
        #   10: internal error (e.g., parsing json data)
        def register(reg_code, email: nil)
          if !backend.product
            [1, "Product not selected yet"]
          elsif backend.registration.reg_code
            [2, "Product already registered"]
          elsif backend.registration.requirement == Agama::Registration::Requirement::NOT_REQUIRED
            [3, "Product does not require registration"]
          else
            connect_result(first_error_code: 4) do
              backend.registration.register(reg_code, email: email)
            end
          end
        end

        # Tries to deregister.
        #
        # @note Software is not automatically probed after deregistering the product. The reason is
        #   to avoid dealing with possible probing issues in the deregistration D-Bus API. Clients
        #   have to explicitly call to #Probe after deregistering a product.
        #
        # @return [Array(Integer, String)] Result code and a description.
        #   Possible result codes:
        #   0: success
        #   1: missing product
        #   2: not registered yet
        #   3: network error
        #   4: timeout error
        #   5: api error
        #   6: missing credentials
        #   7: incorrect credentials
        #   8: invalid certificate
        #   9: internal error (e.g., parsing json data)
        def deregister
          if !backend.product
            [1, "Product not selected yet"]
          elsif !backend.registration.reg_code
            [2, "Product not registered yet"]
          else
            connect_result(first_error_code: 3) do
              backend.registration.deregister
            end
          end
        end

        REGISTRATION_INTERFACE = "org.opensuse.Agama1.Registration"
        private_constant :REGISTRATION_INTERFACE

        dbus_interface REGISTRATION_INTERFACE do
          dbus_reader(:reg_code, "s")

          dbus_reader(:email, "s")

          dbus_reader(:requirement, "u")

          dbus_method(:Register, "in reg_code:s, in options:a{sv}, out result:(us)") do |*args|
            [register(args[0], email: args[1]["Email"])]
          end

          dbus_method(:Deregister, "out result:(us)") { [deregister] }
        end

      private

        # @return [Agama::Software]
        attr_reader :backend

        # @return [Logger]
        attr_reader :logger

        # Registers callback to be called
        def register_callbacks
          # FIXME: Product issues might change after changing the registration. Nevertheless,
          #   #on_issues_change callbacks should be used for emitting issues signals, ensuring they
          #   are emitted every time the backend changes its issues. Currently, #on_issues_change
          #   cannot be used for product issues. Note that Software::Manager backend takes care of
          #   both software and product issues. And it already uses #on_issues_change callbacks for
          #   software related issues.
          backend.registration.on_change { issues_properties_changed }
          backend.registration.on_change { registration_properties_changed }
        end

        def registration_properties_changed
          dbus_properties_changed(REGISTRATION_INTERFACE,
            interfaces_and_properties[REGISTRATION_INTERFACE], [])
        end

        def product_properties_changed
          dbus_properties_changed(PRODUCT_INTERFACE,
            interfaces_and_properties[PRODUCT_INTERFACE], [])
        end

        # Result from calling to SUSE connect.
        #
        # @raise [Exception] if an unexpected error is found.
        #
        # @return [Array(Integer, String)] List including a result code and a description
        #   (e.g., [1, "Connection to registration server failed (network error)"]).
        def connect_result(first_error_code: 1, &block)
          block.call
          [0, ""]
        rescue SocketError => e
          connect_result_from_error(e, first_error_code, "network error")
        rescue Timeout::Error => e
          connect_result_from_error(e, first_error_code + 1, "timeout")
        rescue SUSE::Connect::ApiError => e
          connect_result_from_error(e, first_error_code + 2)
        rescue SUSE::Connect::MissingSccCredentialsFile => e
          connect_result_from_error(e, first_error_code + 3, "missing credentials")
        rescue SUSE::Connect::MalformedSccCredentialsFile => e
          connect_result_from_error(e, first_error_code + 4, "incorrect credentials")
        rescue OpenSSL::SSL::SSLError => e
          connect_result_from_error(e, first_error_code + 5, "invalid certificate")
        rescue JSON::ParserError => e
          connect_result_from_error(e, first_error_code + 6)
        end

        # Generates a result from a given error.
        #
        # @param error [Exception]
        # @param error_code [Integer]
        # @param details [String, nil]
        #
        # @return [Array(Integer, String)] List including an error code and a description.
        def connect_result_from_error(error, error_code, details = nil)
          logger.error("Error connecting to registration server: #{error}")

          description = "Connection to registration server failed: #{error}"
          description += " (#{details})" if details

          [error_code, description]
        end
      end
    end
  end
end
