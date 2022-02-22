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
    # YaST D-Bus object (/org/opensuse/YaST/Installer1)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Language < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Language1".freeze
      private_constant :PATH

      LANGUAGE_INTERFACE = "org.opensuse.DInstaller.Language1".freeze
      private_constant :LANGUAGE_INTERFACE

      # @param installer [Yast2::Installer] YaST installer instance
      def initialize(installer, logger)
        @installer = installer
        @logger = logger

        super(PATH)
      end

      dbus_interface LANGUAGE_INTERFACE do
        dbus_reader :available_languages, "a(ssa{sv})"
        attr_writer :available_languages
        dbus_watcher :available_languages

        dbus_reader :marked_for_install, "as"

        dbus_method :ToInstall, "in LangIDs:as" do |lang_ids|
          logger.info "ToInstall #{lang_ids.inspect}"
          select_to_install(lang_ids)

          self[DBus::PROPERTY_INTERFACE].PropertiesChanged(LANGUAGE_INTERFACE, {"MarkedForInstall" => lang_ids}, [])
        end
      end

      def available_languages
        @available_languages ||= installer.languages.map { |k,v| [k, v.first, {}] }
      end

      def marked_for_install
        # TODO: change when installer support multiple target languages
        res = [installer.language]
        logger.info "MarkedForInstall #{res}"
        res
      end

      def select_to_install(lang_ids)
        # TODO: adapt installer API to allow more languages to install
        installer.language = lang_ids.first
      end

    private

      attr_reader :installer, :logger

    end
  end
end
