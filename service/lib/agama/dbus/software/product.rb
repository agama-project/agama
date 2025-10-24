# frozen_string_literal: true

# Copyright (c) [2023-2025] SUSE LLC
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
require "agama/errors"
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
            data = {
              "description"  => product.localized_description,
              "icon"         => product.icon,
              "registration" => product.registration
            }
            data["license"] = product.license if product.license
            [
              product.id,
              product.display_name,
              data
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
          elsif backend.registration.registered
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

        def registered
          !!backend.registration.registered
        end

        def reg_code
          backend.registration.reg_code || ""
        end

        def email
          backend.registration.email || ""
        end

        def url
          backend.registration.registration_url || ""
        end

        def url=(url)
          # dbus has problem with nils, so empty string is only for dbus nil
          backend.registration.registration_url = url.empty? ? nil : url
        end

        # list of already registered addons
        #
        # @return [Array<Array<String>>] each list contains three items: addon id, version and
        # registration code
        def registered_addons
          backend.registration.registered_addons.map do |addon|
            [
              addon.name,
              # return empty string if the version was not explicitly specified (was autodetected)
              addon.required_version ? addon.version : "",
              addon.reg_code
            ]
          end
        end

        # list of available addons
        #
        # @return [Array<Hash<String, Object>>] List of addons
        def available_addons
          addons = backend.registration.available_addons || []

          addons.map do |a|
            {
              "id"          => a.identifier,
              "version"     => a.version,
              "label"       => a.friendly_name,
              "available"   => a.available,    # boolean
              "free"        => a.free,         # boolean
              "recommended" => a.recommended,  # boolean
              "description" => a.description,
              "type"        => a.product_type, # "extension"
              "release"     => a.release_stage # "beta"
            }
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
        #   13: Failed to add service from registration
        def register(reg_code, email: nil)
          if !backend.product
            [1, "Product not selected yet"]
          # report success and do nothing when already registered with the same code
          elsif backend.registration.registered && backend.registration.reg_code == reg_code
            [0, ""]
          elsif backend.registration.registered
            [2, "Product already registered"]
          elsif !backend.product.registration
            [3, "Product does not require registration"]
          else
            connect_result(first_error_code: 4) do
              backend.registration.register(reg_code, email: email)
            end
          end
        end

        # Tries to register the given addon. The base product must be already registered and if the
        # addon requires some other addon it must be already registered as well. (The code does not
        # check any dependencies.)
        #
        # @note Software is not automatically probed after registering the product. The reason is
        #   to avoid dealing with possible probing issues in the registration D-Bus API. Clients
        #   have to explicitly call to #Probe after registering a product.
        #
        # @param name [String] name (id) of the addon, e.g. "sle-ha"
        # @param version [String] version of the addon, e.g. "16.0", if empty the version is found
        #   automatically in the list of available addons
        # @param reg_code [String] registration code, if the code is not required for the addon use
        # an empty string ("")
        #
        # @return [Array(Integer, String)] Result code and a description.
        #   Possible result codes:
        #   0: success
        #   1: a base product was not selected yet
        #   2: the base product does not require registration
        #   3: the base product was not registered yet
        #   4: network error
        #   5: timeout error
        #   6: api error
        #   7: missing credentials
        #   8: incorrect credentials
        #   9: invalid certificate
        #   10: internal error (e.g., parsing json data)
        #   11: addon not found
        #   12: addon found in multiple versions
        #   13: Failed to add service from registration
        def register_addon(name, version, reg_code)
          if !backend.product
            [1, "Product not selected yet"]
          elsif !backend.product.registration
            [2, "Base product does not require registration"]
          elsif !backend.registration.registered
            [3, "Base product not registered yet"]
          else
            connect_result(first_error_code: 4) do
              backend.registration.register_addon(name, version, reg_code)
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
        #   13: Failed to remove service from registration
        def deregister
          if !backend.product
            [1, "Product not selected yet"]
          elsif !backend.registration.registered
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
          dbus_reader(:registered, "b")

          dbus_reader(:reg_code, "s")

          dbus_reader(:email, "s")

          dbus_accessor(:url, "s")

          dbus_reader(:registered_addons, "a(sss)")

          dbus_reader(:available_addons, "aa{sv}")

          dbus_method(:Register, "in reg_code:s, in options:a{sv}, out result:(us)") do |*args|
            [register(args[0], email: args[1]["Email"])]
          end

          dbus_method(:RegisterAddon, "in name:s, in version:s, in reg_code:s, out result:(us)") do |*args|
            [register_addon(*args)]
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
          backend.on_issues_change { issues_properties_changed }
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
        rescue Errors::Registration::ExtensionNotFound => e
          connect_result_from_error(e, first_error_code + 7)
        rescue Errors::Registration::MultipleExtensionsFound => e
          connect_result_from_error(e, first_error_code + 8)
        rescue Agama::Software::ServiceError => e
          connect_result_from_error(e, first_error_code + 9)
        rescue StandardError => e
          connect_result_from_error(e, first_error_code + 10)
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
