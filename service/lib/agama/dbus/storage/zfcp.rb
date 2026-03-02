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
require "agama/dbus/with_issues"
require "agama/dbus/with_progress"
require "agama/storage/zfcp/manager"
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
        include WithIssues
        include WithProgress

        PATH = "/org/opensuse/Agama/Storage1/ZFCP"
        private_constant :PATH

        # @param manager [Agama::Storage::ZFCP::Manager]
        # @param logger [Logger, nil]
        def initialize(manager, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @manager = manager
          @serialized_system = serialize_system
          @serialized_config = serialize_config
          @serialized_issues = serialize_issues
          register_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1.DASD" do
          dbus_reader_attr_accessor :serialized_system, "s", dbus_name: "System"
          dbus_reader_attr_accessor :serialized_config, "s", dbus_name: "Config"
          dbus_reader_attr_accessor :serialized_issues, "s", dbus_name: "Issues"
          dbus_method(:Probe) { probe }
          dbus_method(:SetConfig, "in serialized_config:s") do |serialized_config|
            configure(serialized_config)
          end
          dbus_signal(:ProgressChanged, "serialized_progress:s")
          dbus_signal(:ProgressFinished)
        end

        # Implementation for the API method #Probe.
        def probe
          logger.info("Probing zFCP")

          start_progress(2, PROBING_STEP)
          perform_probe

          next_progress_step(CONFIGURING_STEP)
          configure_with_current

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

          # Do not configure if the same config was already successfully applied.
          return if manager.configured?(config_json)

          logger.info("Configuring zFCP")

          start_progress(1, CONFIGURING_STEP)
          perform_configuration(config_json)

          finish_progress
        end

      private

        PROBING_STEP = N_("Probing zFCP")
        private_constant :PROBING_STEP

        CONFIGURING_STEP = N_("Configuring zFCP")
        private_constant :CONFIGURING_STEP

        # @return [Agama::Storage::ZFCP::Manager]
        attr_reader :manager

        def register_callbacks
          on_progress_change { self.ProgressChanged(serialize_progress) }
          on_progress_finish { self.ProgressFinished }
        end

        # Probes zFCP and updates the associated info.
        #
        # @see #update_system_info
        def perform_probe
          manager.probe
          update_serialized_system
        end

        # Configures zFCP and updates the associated info.
        #
        # @param config_json [Hash]
        def perform_configuration(config_json)
          manager.configure(config_json)
          update_serialized_system
          update_serialized_config
          update_serialized_issues
        end

        # Applies the current config, if any.
        def configure_with_current
          return unless manager.config_json

          perform_configuration(manager.config_json)
        end

        # Updates the system info if needed.
        def update_serialized_system
          serialized_system = serialize_system
          return if self.serialized_system == serialized_system

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_system = serialized_system
          self.SystemChanged(serialized_system)
        end

        # Updates the config info if needed.
        def update_serialized_config
          serialized_config = serialize_config
          return if self.serialized_config == serialized_config

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_config = serialized_config
        end

        # Updates the issues info if needed.
        def update_serialized_issues
          serialized_issues = serialize_issues
          return if self.serialized_issues == serialized_issues

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_issues = serialized_issues
        end

        # Generates the serialized JSON of the system.
        #
        # @return [String]
        def serialize_system
          manager.probe unless manager.probed?

          json = {
            lunScan:     manager.allow_lun_scan?,
            controllers: controllers_json,
            devices:     devices_json
          }
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the config.
        #
        # @return [String]
        def serialize_config
          JSON.pretty_generate(manager.config_json)
        end

        # Generates the serialized JSON of the list of issues.
        #
        # @return [String]
        def serialize_issues
          super(manager.issues)
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
          {
            channel:    device.channel,
            wwpn:       device.wwpn,
            lun:        device.lun,
            active:     device.active?,
            deviceName: device.active? ? device.device_name : nil
          }.compact
        end
      end
    end
  end
end
