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
require "agama/dbus/base_object"
require "agama/dbus/clients/locale"
require "agama/dbus/clients/network"
require "agama/dbus/interfaces/issues"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/with_service_status"

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

          dbus_method :SelectProduct, "in ProductID:s" do |product_id|
            old_product_id = backend.product

            if old_product_id == product_id
              logger.info "Do not changing the product as it is still the same (#{product_id})"
              return
            end

            logger.info "Selecting product #{product_id}"
            select_product(product_id)
            dbus_properties_changed(SOFTWARE_INTERFACE, { "SelectedBaseProduct" => product_id }, [])
          end

          # value of result hash is category, description, icon, summary and order
          dbus_method :ListPatterns, "in Filtered:b, out Result:a{s(ssssi)}" do |filtered|
            [
              backend.patterns(filtered).each_with_object({}) do |pattern, result|
                # make sure all attributes are already preloaded, adjust the "patterns" method
                # in service/lib/agama/software/manager.rb when changing this list
                value = [
                  pattern.category,
                  pattern.description,
                  pattern.icon,
                  pattern.summary,
                  pattern.order.to_i
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
          backend.products.map do |id, data|
            [id, data["name"], { "description" => data["description"] }].freeze
          end
        end

        # Returns the selected base product
        #
        # @return [String] Product ID or an empty string if no product is selected
        def selected_product
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
          dbus_reader :reg_code, "s"

          dbus_reader :email, "s"

          dbus_reader :state, "u"

          dbus_method :Register, "in reg_code:s, in options:a{sv}, out result:u" do
            |reg_code, options|
            backend.registration.register(reg_code, email: options["Email"])
            # map errors to exit codes?
            0
          end

          dbus_method :Deregister, "out result:u" do
            backend.registration.deregister
            # map errors to exit codes?
            0
          end
        end

        def reg_code
          backend.registration.reg_code || ""
        end

        def email
          backend.registration.email || ""
        end

        # Replace #State by #IsDisabled and #isOptional ?
        def state
          return 0 if backend.registration.disabled?
          return 1 if backend.registration.optional?
          return 2 unless backend.registration.optional?
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
      end
    end
  end
end
