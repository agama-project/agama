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

module DInstaller
  module DBus
    module Storage
      # D-Bus object to get the list of actions to perform in the system
      class Actions < ::DBus::Object
        PATH = "/org/opensuse/DInstaller/Storage/Actions1"
        private_constant :PATH

        INTERFACE = "org.opensuse.DInstaller.Storage.Actions1"
        private_constant :INTERFACE

        def initialize(backend, logger)
          @logger = logger
          @backend = backend

          super(PATH)
        end

        dbus_interface INTERFACE do
          # TODO: emit a signal when actions change (e.g., when a proposal is calculated). Right
          #   now, actions changes can only be detected by subcribing to PropertiesChange signal
          #   from Storage::Proposal dbus object.
          dbus_reader :all, "aa{sv}"
        end

        def all
          backend.all.map { |a| to_dbus(a) }
        end

        def refresh
          PropertiesChanged(INTERFACE, { "All" => all }, [])
        end

      private

        attr_reader :backend

        def to_dbus(action)
          { "Text" => backend.text_for(action), "Subvol" => backend.subvol_action?(action) }
        end
      end
    end
  end
end
