# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
require "json"
require "agama/dbus/base_object"
require "agama/dbus/interfaces/issues"
require "agama/dbus/with_service_status"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage iSCSI.
      class ISCSI < BaseObject
        include WithServiceStatus
        include DBus::Interfaces::Issues

        PATH = "/org/opensuse/Agama/Storage1/ISCSI"
        private_constant :PATH

        # @param backend [Agama::Storage::ISCSI::Manager]
        # @param service_status [Agama::DBus::ServiceStatus, nil]
        # @param logger [Logger, nil]
        def initialize(backend, service_status: nil, logger: nil)
          super(PATH, logger: logger)
          @backend = backend
          @service_status = service_status
        end

        # List of issues, see {DBus::Interfaces::Issues}
        #
        # @return [Array<Agama::Issue>]
        def issues
          []
        end

        ISCSI_INTERFACE = "org.opensuse.Agama.Storage1.ISCSI"
        private_constant :ISCSI_INTERFACE

        # Applies the given serialized iSCSI config according to the JSON schema.
        #
        # @todo Raise error if the config is not valid.
        #
        # @param serialized_config [String] Serialized iSCSI config.
        # @return [Integer] 0 success; 1 error
        def apply_iscsi_config(serialized_config)
          logger.info("Setting iSCSI config from D-Bus: #{serialized_config}")

          config_json = JSON.parse(serialized_config, symbolize_names: true)
          success = backend.apply_config(config_json)
          success ? 0 : 1
        end

        dbus_interface ISCSI_INTERFACE do
          dbus_method(:SetConfig, "in serialized_config:s, out result:u") do |serialized_config|
            busy_while { apply_iscsi_config(serialized_config) }
          end
        end

      private

        # @return [Agama::Storage::ISCSI::Manager]
        attr_reader :backend
      end
    end
  end
end
