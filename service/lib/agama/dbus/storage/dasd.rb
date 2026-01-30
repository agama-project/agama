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

require "agama/dbus/base_object"
require "agama/with_progress"
require "dbus"
require "json"
require "yast"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage DASD.
      class DASD < BaseObject
        include Yast::I18n
        include Agama::WithProgress

        PATH = "/org/opensuse/Agama/Storage1/DASD"
        private_constant :PATH

        # @param manager [Agama::Storage::DASD::Manager]
        # @param logger [Logger, nil]
        def initialize(manager, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @manager = manager
          register_progress_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1.DASD" do
          dbus_method(:GetSystem, "out system:s") { recover_system }
          dbus_method(:GetConfig, "out config:s") { recover_config }
          dbus_method(:SetConfig, "in serialized_config:s") do |serialized_config|
            configure(serialized_config)
          end
          dbus_signal(:SystemChanged, "system:s")
          dbus_signal(:ProgressChanged, "progress:s")
          dbus_signal(:ProgressFinished)
          dbus_signal(:FormatChanged, "summary:s")
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

        # Applies the given serialized DASD config.
        #
        # @todo Raise error if the config is not valid.
        #
        # @param serialized_config [String] Serialized DASD config according to the JSON schema.
        def configure(serialized_config)
          config_json = JSON.parse(serialized_config, symbolize_names: true)

          # Do not configure if there is no config
          return unless config_json

          # Do not configure if there is nothing to change.
          return if manager.configured?(config_json)

          # TODO: run everything in a new thread.

          logger.info("Configuring DASD")

          start_progress(1, _("Configuring DASD"))
          manager.configure(config_json)
          emit_system_changed
          finish_progress
        end

      private

        # @return [Agama::Storage::ISCSI::Manager]
        attr_reader :manager

        # @return [Hash]
        def system_json
          { devices: devices_json }
        end

        # @return [Hash]
        def devices_json
          manager.devices.map { |d| device_json(n) }
        end

        # @param dasd [Y2S390::Dasd]
        # @return [Hash]
        def device_json(dasd)
          {
            channel: dasd.id,
            deviceName: dasd.device_name || "",
            type: manager.device_type(dasd),
            diag: dasd.use_diag,
            accessType: dasd.access_type || "",
            partitionInfo: dasd.partition_info || "",
            status: dasd.status.to_s,
            active: !dasd.offline?,
            formatted: dasd.formatted?,
          }
        end

        # Emits the SystemChanged signal
        def emit_system_changed
          self.SystemChanged(recover_system)
        end

        def register_progress_callbacks
          on_progress_change { self.ProgressChanged(progress.to_json) }
          on_progress_finish { self.ProgressFinished }
        end
      end
    end
  end
end
