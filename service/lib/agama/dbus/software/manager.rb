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
require "agama/dbus/base_object"
require "agama/dbus/with_service_status"
require "agama/dbus/clients/locale"
require "agama/dbus/clients/network"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/interfaces/validation"

module Agama
  module DBus
    module Software
      # D-Bus object to manage software installation
      class Manager < BaseObject
        include WithServiceStatus
        include Interfaces::Progress
        include Interfaces::ServiceStatus
        include Interfaces::Validation

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

        SOFTWARE_INTERFACE = "org.opensuse.Agama.Software1"
        private_constant :SOFTWARE_INTERFACE

        dbus_interface SOFTWARE_INTERFACE do
          dbus_reader :available_base_products, "a(ssa{sv})"

          dbus_reader :selected_base_product, "s"

          # documented way to be able to write to patterns and trigger signal
          attr_writer :selected_patterns

          # selected patterns is hash with pattern name as id and 0 for user selected and
          # 1 for auto selected. Can be extended in future e.g. for mandatory patterns
          dbus_attr_reader :selected_patterns, "a{sy}"

          dbus_method :SelectProduct, "in ProductID:s" do |product_id|
            old_product_id = backend.product

            if old_product_id == product_id
              logger.info "Do not changing the product as it is still the same (#{product_id})"
              return
            end

            logger.info "Selecting product #{product_id}"
            select_product(product_id)
            dbus_properties_changed(SOFTWARE_INTERFACE, { "SelectedBaseProduct" => product_id }, [])
            update_validation # as different product means different software selection
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

        def available_base_products
          backend.products.map do |id, data|
            [id, data["name"], { "description" => localized_description(data) }].freeze
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

          update_validation # probe do force proposal
        end

        def propose
          busy_while { backend.propose }
          update_validation

          nil # explicit nil as return value
        end

        def install
          busy_while { backend.install }
        end

        def finish
          busy_while { backend.finish }
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
        end

        # find translated product description if available
        # @param data [Hash] product configuration from the YAML file
        # @return [String,nil] Translated product description (if available)
        #   or the untranslated description, nil if not found
        def localized_description(data)
          translations = data["translations"]&.[]("description")
          lang = ENV["LANG"] || ""

          # no translations or language not set, return untranslated value
          return data["description"] if !translations.is_a?(Hash) || lang.empty?

          # remove the character encoding if present
          lang = lang.split(".").first
          # full matching (language + country)
          return translations[lang] if translations[lang]

          # remove the country part
          lang = lang.split("_").first
          # partial match (just the language)
          return translations[lang] if translations[lang]

          # fallback to original untranslated description
          data["description"]
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
