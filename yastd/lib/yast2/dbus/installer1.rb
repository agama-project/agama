# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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

module Yast2
  module DBus
    # YaST D-Bus object (/org/opensuse/YaST/Installer)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Installer < ::DBus::Object
      attr_reader :installer, :logger

      # @param installer [Yast2::Installer] YaST installer instance
      # @param args [Array<Object>] ::DBus::Object arguments
      def initialize(installer, logger, *args)
        @installer = installer
        @logger = logger
        @available_languages = installer.languages

        installer.dbus_obj = self

        super(*args)
      end

      LANGUAGE_INTERFACE = "org.opensuse.YaST.Installer1.Language"
      dbus_interface LANGUAGE_INTERFACE do
        dbus_attr_reader :available_languages, "a(ss{sv})"
        attr_writer :available_languages
        dbus_watcher :available_languages

        def marked_for_install
          # TODO: change when installer support multiple target languages
          [installer.language]
        end

        dbus_reader :marked_for_install, "as"

        dbus_method :ToInstall, "in LangIDs:as" do |lang_ids|
          logger.info "ToInstall #{lang_ids.inspect}"

          # TODO: adapt installer API to allow more languages to install
          installer.language = lang_ids.first
          self[DBus::PROPERTY_INTERFACE].PropertiesChanged(LANGUAGE_INTERFACE, {"MarkedForInstall" => lang_ids}, [])
        end
      end

      SOFTWARE_INTERFACE = "org.opensuse.YaST.Installer1.Software"
      dbus_interface SOFTWARE_INTERFACE do
        dbus_attr_reader :available_base_products, "a(ss{sv})"
        attr_writer :available_base_products
        dbus_watcher :available_base_products

        def selected_base_product
          installer.product
        end

        dbus_reader :selected_base_product, "s"


        dbus_method :SelectProduct, "in ProductID:s" do |product_id|
          logger.info "SelectProduct #{product_id}"

          installer.product = product_id
          self[DBus::PROPERTY_INTERFACE].PropertiesChanged(SOFTWARE_INTERFACE, {"SelectedBaseProduct" => product_id}, [])
        end
      end
    end
  end
end
