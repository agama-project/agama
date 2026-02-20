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
require "agama/storage/zfcp/manager"
require "agama/with_progress"
require "dbus"
require "json"
require "yast"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage zFCP.
      class ZFCP < BaseObject
        extend Yast::I18n
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
          dbus_method(:GetIssues, "out issues:s") { recover_issues }
          dbus_method(:SetConfig, "in serialized_config:s") do |serialized_config|
            configure(serialized_config)
          end
          dbus_signal(:SystemChanged, "system:s")
          dbus_signal(:ProgressChanged, "progress:s")
          dbus_signal(:ProgressFinished)
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

        # Gets the serialized list of issues.
        #
        # @return [String]
        def recover_issues
          json = manager.issues.map(&:to_hash)
          JSON.pretty_generate(json)
        end

        # Implementation for the API method #Probe.
        def probe
          logger.info("Probing zFCP")

          start_progress(2, PROBING_STEP)
          manager.probe

          next_progress_step(CONFIGURING_STEP)
          configure_with_current

          emit_system_changed
          finish_progress
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

          # Do not configure if the config has not changed.
          return if manager.config_json == config_json

          logger.info("Configuring zFCP")

          start_progress(1, CONFIGURING_STEP)
          system_changed = manager.configure(config_json)

          emit_system_changed if system_changed
          finish_progress
        end

      private

        PROBING_STEP = N_("Probing zFCP")
        private_constant :PROBING_STEP

        CONFIGURING_STEP = N_("Configuring zFCP")
        private_constant :CONFIGURING_STEP

        # @return [Agama::Storage::ZFCP::Manager]
        attr_reader :manager

        # Applies the current config, if any.
        def configure_with_current
          return unless manager.config_json

          manager.configure(manager.config_json)
        end

        # @return [Hash]
        def system_json
          {
            lunScan:     manager.allow_lun_scan?,
            controllers: controllers_json,
            devices:     devices_json
          }
        end

        # @return [Hash]
        def controllers_json
          manager.controllers.map { |c| controller_json(c) }
        end

        # @param controller [Agama::Storage::ZFCP::Controller]
        # @return [Hash]
        def controller_json(controller)
          {
            channel: controller.channel,
            wwpns:   controller.wwpns,
            lunScan: controller.lun_scan?,
            active:  controller.active?
          }
        end

        # @return [Hash]
        def devices_json
          manager.devices.map { |d| device_json(d) }
        end

        # @param device [Agama::Storage::ZFCP::Device]
        # @return [Hash]
        def device_json(device)
          json = {
            channel: device.channel,
            wwpn:    device.wwpn,
            lun:     device.lun,
            active:  device.active?
          }
          json[:deviceName] = device.device_name if device.active?
          json
        end

        # Emits the SystemChanged signal
        def emit_system_changed
          self.SystemChanged(recover_system)
        end

        def register_callbacks
          on_progress_change { self.ProgressChanged(progress.to_json) }
          on_progress_finish { self.ProgressFinished }
        end
      end
    end
  end
end
