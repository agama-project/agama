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
require "dinstaller/language"
require "dinstaller/errors"

module DInstaller
  module DBus
    # YaST D-Bus object (/org/opensuse/DInstaller/Language1)
    #
    # @see https://rubygems.org/gems/ruby-dbus
    class Language < ::DBus::Object
      PATH = "/org/opensuse/DInstaller/Language1"
      private_constant :PATH

      LANGUAGE_INTERFACE = "org.opensuse.DInstaller.Language1"
      private_constant :LANGUAGE_INTERFACE

      # @param backend [DInstaller::Language]
      # @param logger [Logger]
      def initialize(backend, logger)
        @backend = backend
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
          result = select_to_install(lang_ids)

          PropertiesChanged(LANGUAGE_INTERFACE, { "MarkedForInstall" => lang_ids }, [])
          result ? 0 : 1
        end
      end

      def available_languages
        @available_languages ||= backend.languages.map { |k, v| [k, v.first, {}] }
      end

      def marked_for_install
        # TODO: change when installer support multiple target languages
        result = [backend.language]
        logger.info "MarkedForInstall #{result}"
        result
      end

      def select_to_install(lang_ids)
        backend.language = lang_ids.first
        true
      rescue Errors::InvalidValue
        false
      end

    private

      attr_reader :logger
      attr_reader :backend
    end
  end
end
