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

require "agama/dbus/clients/base"

module Agama
  module DBus
    module Clients
      # D-Bus client for language configuration
      class Language < Base
        def initialize
          super

          @dbus_object = service.object("/org/opensuse/Agama/Language1")
          @dbus_object.introspect
        end

        def service_name
          @service_name ||= "org.opensuse.Agama.Language1"
        end

        # Available languages for the installation
        #
        # @return [Array<Array<String, String>>] id and name of each language
        def available_languages
          dbus_object["org.opensuse.Agama.Language1"]["AvailableLanguages"].map { |l| l[0..1] }
        end

        # Languages selected to install
        #
        # @return [Array<String>] ids of the languages
        def selected_languages
          dbus_object["org.opensuse.Agama.Language1"]["MarkedForInstall"]
        end

        # Selects the languages to install
        #
        # @param ids [Array<String>]
        def select_languages(ids)
          dbus_object.ToInstall(ids)
        end

        # Finishes the language installation
        def finish
          dbus_object.Finish
        end

        # Registers a callback to run when the language changes
        #
        # @note Signal subscription is done only once. Otherwise, the latest subscription overrides
        #   the previous one.
        #
        # @param block [Proc] Callback to run when a language is selected
        def on_language_selected(&block)
          on_properties_change(dbus_object) do |_, changes, _|
            languages = changes["MarkedForInstall"]
            block.call(languages)
          end
        end

      private

        # @return [::DBus::Object]
        attr_reader :dbus_object
      end
    end
  end
end
