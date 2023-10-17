# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "agama/dbus/clients/locale"
require "agama/dbus/clients/network"
require "agama/dbus/interfaces/issues"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/with_service_status"
require "agama/registration"

module Agama
  module DBus
    module Software
      # D-Bus object to manage software installation
      class Manager < BaseObject
        include WithServiceStatus
        include Interfaces::Progress
        include Interfaces::ServiceStatus
        include Interfaces::Issues

        PATH = "/org/opensuse/Agama/Software1"
        private_constant :PATH

        # Constructor
        #
        # @param backend [Agama::Software]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
          register_callbacks
          register_progress_callbacks
          register_service_status_callbacks
          @selected_patterns = {}
        end

        # List of issues, see {DBus::Interfaces::Issues}
        #
        # @return [Array<Agama::Issue>]
        def issues
          backend.issues
        end

        SOFTWARE_INTERFACE = "org.opensuse.Agama.Software1"
        private_constant :SOFTWARE_INTERFACE

        dbus_interface SOFTWARE_INTERFACE do
          dbus_reader :available_products, "a(ssa{sv})"

          dbus_reader :selected_product, "s"

          dbus_method :SelectProduct, "in id:s, out result:(us)" do |id|
            logger.info "Selecting product #{id}"

            code, description = select_product(id)

            if code == 0
              dbus_properties_changed(SOFTWARE_INTERFACE, { "SelectedProduct" => id }, [])
              dbus_properties_changed(REGISTRATION_INTERFACE, { "Requirement" => requirement }, [])
            end

            [[code, description]]
          end

          # value of result hash is category, description, icon, summary and order
          dbus_method :ListPatterns, "in Filtered:b, out Result:a{s(sssss)}" do |filtered|
            [
              backend.patterns(filtered).each_with_object({}) do |pattern, result|
                # make sure all attributes are already preloaded, adjust the "patterns" method
                # in service/lib/agama/software/manager.rb when changing this list
                value = [
                  pattern.category,
                  pattern.description,
                  pattern.icon,
                  pattern.summary,
                  pattern.order
                ]
                result[pattern.name] = value
              end
            ]
          end

          # documented way to be able to write to patterns and trigger signal
          attr_writer :selected_patterns

          # selected patterns is hash with pattern name as id and 0 for user selected and
          # 1 for auto selected. Can be extended in future e.g. for mandatory patterns
          dbus_attr_reader :selected_patterns, "a{sy}"

          dbus_method(:AddPattern, "in id:s") { |p| backend.add_pattern(p) }
          dbus_method(:RemovePattern, "in id:s") { |p| backend.remove_pattern(p) }
          dbus_method(:SetUserPatterns, "in ids:as") { |ids| backend.user_patterns = ids }

          dbus_method :ProvisionsSelected, "in Provisions:as, out Result:ab" do |provisions|
            [provisions.map { |p| backend.provision_selected?(p) }]
          end

          dbus_method :IsPackageInstalled, "in Name:s, out Result:b" do |name|
            backend.package_installed?(name)
          end

          dbus_method(:UsedDiskSpace, "out SpaceSize:s") { backend.used_disk_space }

          dbus_method(:Probe) { probe }
          dbus_method(:Propose) { propose }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
        end

        def available_products
          backend.products.map do |product|
            [product.id, product.display_name, { "description" => product.description }]
          end
        end

        # Returns the selected base product
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

        def probe
          busy_while { backend.probe }
        end

        def propose
          busy_while { backend.propose }

          nil # explicit nil as return value
        end

        def install
          busy_while { backend.install }
        end

        def finish
          busy_while { backend.finish }
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
        # @param reg_code [String]
        # @param email [String, nil]
        #
        # @return [Array(Integer, String)] Result code and a description.
        #   Possible result codes:
        #   0: success
        #   1: missing product
        #   2: already registered
        #   3: network error
        #   4: timeout error
        #   5: api error
        #   6: missing credentials
        #   7: incorrect credentials
        #   8: invalid certificate
        #   9: internal error (e.g., parsing json data)
        def register(reg_code, email: nil)
          if !backend.product
            [1, "Product not selected yet"]
          elsif backend.registration.reg_code
            [2, "Product already registered"]
          else
            connect_result(first_error_code: 3) do
              backend.registration.register(reg_code, email: email)
            end
          end
        end

        # Tries to deregister.
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

      private

        # @return [Agama::Software]
        attr_reader :backend

        # Registers callback to be called
        def register_callbacks
          lang_client = Agama::DBus::Clients::Locale.new
          lang_client.on_language_selected do |language_ids|
            backend.languages = language_ids
          end

          nm_client = Agama::DBus::Clients::Network.new
          nm_client.on_connection_changed do |connected|
            probe if connected
          end

          backend.on_selected_patterns_change do
            self.selected_patterns = compute_patterns
          end

          backend.registration.on_change { registration_properties_changed }

          backend.on_issues_change { issues_properties_changed }
        end

        USER_SELECTED_PATTERN = 0
        AUTO_SELECTED_PATTERN = 1
        def compute_patterns
          patterns = {}
          user_selected, auto_selected = backend.selected_patterns
          user_selected.each { |p| patterns[p] = USER_SELECTED_PATTERN }
          auto_selected.each { |p| patterns[p] = AUTO_SELECTED_PATTERN }

          patterns
        end

        def registration_properties_changed
          dbus_properties_changed(REGISTRATION_INTERFACE,
            interfaces_and_properties[REGISTRATION_INTERFACE], [])
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

          description = "Connection to registration server failed"
          description += " (#{details})" if details

          [error_code, description]
        end
      end
    end
  end
end
