# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "agama/storage/zfcp/manager"
require "dbus"
require "json"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage zFCP.
      class ZFCP
        include Yast::I18n
        include Agama::WithProgress

        PATH = "/org/opensuse/Agama/Storage1/ZFCP"
        private_constant :PATH

        # @param manager [Agama::Storage::ZFCP::Manager]
        # @param logger [Logger, nil]
        def initialize(manager, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @manager = manager
          register_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1.DASD" do
          dbus_method(:Probe) { probe }
          dbus_method(:GetSystem, "out system:s") { recover_system }
          dbus_method(:GetConfig, "out config:s") { recover_config }
          dbus_method(:SetConfig, "in serialized_config:s") do |serialized_config|
            configure(serialized_config)
          end
          dbus_signal(:SystemChanged, "system:s")
          dbus_signal(:ProgressChanged, "progress:s")
          dbus_signal(:ProgressFinished)
        end

        # Implementation for the API method #Probe.
        def probe
          start_progress(1, _("Probing zFCP devices"))
          manager.probe
          emit_system_changed
          finish_progress
        end

        # Gets the serialized system information.
        #
        # @return [String]
        def recover_system
          manager.probe unless manager.probed?
          JSON.pretty_generate(system_json)
        end

        # Gets the serialized config.
        #
        # @return [String]
        def recover_config
          JSON.pretty_generate(manager.config_json)
        end

        # Applies the given serialized zFCP config.
        #
        # @todo Raise error if the config is not valid.
        #
        # @param serialized_config [String] Serialized zFCP config according to the JSON schema.
        def configure(serialized_config)
          config_json = JSON.parse(serialized_config, symbolize_names: true)

          # Do not configure if there is no config
          return unless config_json

          # Do not configure if there is nothing to change.
          return if manager.configured?(config_json)

          logger.info("Configuring zFCP")
          start_progress(1, _("Configuring zFCP"))
          system_changed = manager.configure(config_json)
          emit_system_changed if system_changed
          finish_progress
        end

      private

        # @return [Agama::Storage::ZFCP::Manager]
        attr_reader :manager

      end
    end
  end
end
