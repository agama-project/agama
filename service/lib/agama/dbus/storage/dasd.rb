# frozen_string_literal: true

# Copyright (c) [2023-2026] SUSE LLC
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
require "agama/dbus/with_progress"
require "dbus"
require "json"
require "yast"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage DASD.
      class DASD < BaseObject
        include Yast::I18n
        include WithProgress

        PATH = "/org/opensuse/Agama/Storage1/DASD"
        private_constant :PATH

        # @param manager [Agama::Storage::DASD::Manager]
        # @param task_runner [Agama::TaskRunner]
        # @param logger [Logger, nil]
        def initialize(manager, task_runner, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @manager = manager
          @task_runner = task_runner
          @serialized_system = serialize_system
          @serialized_config = serialize_config
          register_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1.DASD" do
          dbus_reader_attr_accessor :serialized_system, "s", dbus_name: "System"
          dbus_reader_attr_accessor :serialized_config, "s", dbus_name: "Config"
          dbus_method(:Probe) { probe }
          dbus_method(:SetConfig, "in serialized_config:s") do |serialized_config|
            configure(serialized_config)
          end
          dbus_signal(:SystemChanged, "serialized_system:s")
          dbus_signal(:ProgressChanged, "serialized_progress:s")
          dbus_signal(:ProgressFinished)
          dbus_signal(:FormatChanged, "serialized_summary:s")
          dbus_signal(:FormatFinished, "status:s")
        end

        # Implementation for the API method #Probe.
        def probe
          start_progress(1, _("Probing DASD devices"))
          manager.probe
          update_serialized_system
          finish_progress
        end

        # Applies the given serialized DASD config.
        #
        # @todo Raise error if the config is not valid.
        # @raise [Agama::TaskRunner::BusyError] If an async task is running, see
        # {#run_configure_task}.
        #
        # @param serialized_config [String] Serialized DASD config according to the JSON schema.
        def configure(serialized_config)
          config_json = JSON.parse(serialized_config, symbolize_names: true)

          # Do not configure if there is no config
          return unless config_json

          # Do not configure if there is nothing to change.
          return if manager.configured?(config_json)

          logger.info("Configuring DASD")
          start_progress(1, _("Configuring DASD"))
          run_configure_task(config_json)
        ensure
          finish_progress
        end

      private

        # @return [Agama::Storage::DASD::Manager]
        attr_reader :manager

        # @return [Agama::TaskRunner]
        attr_reader :task_runner

        def register_callbacks
          on_progress_change { self.ProgressChanged(serialize_progress) }
          on_progress_finish { self.ProgressFinished }
          manager.on_format_change do |format_statuses|
            summary_json = format_summary_json(format_statuses)
            serialized_summary = JSON.pretty_generate(summary_json)
            self.FormatChanged(serialized_summary)
          end
          manager.on_format_finish { |process_status| self.FormatFinished(process_status.to_s) }
        end

        # Runs an async task for configuring the system.
        #
        # The configuration could take long time  (e.g., formatting devices). It is important to not
        # block the service in order to make possible to attend other requests.
        #
        # @raise [Agama::TaskRunner::BusyError] If another async task is running, see {TaskRunner}.
        #
        # @param config_json [Hash]
        def run_configure_task(config_json)
          task_runner.async_run("Configure DASD") do
            manager.configure(config_json)
            update_serialized_system
            update_serialized_config
          end
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

        # Generates the serialized JSON of the system.
        #
        # @return [String]
        def serialize_system
          manager.probe unless manager.probed?

          json = { devices: devices_json }
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the config.
        #
        # @return [String]
        def serialize_config
          JSON.pretty_generate(manager.config_json)
        end

        # @return [Hash]
        def devices_json
          manager.devices.map { |d| device_json(d) }
        end

        # @param dasd [Y2S390::Dasd]
        # @return [Hash]
        def device_json(dasd)
          {
            channel:       dasd.id,
            deviceName:    dasd.device_name || "",
            type:          manager.device_type(dasd),
            diag:          dasd.use_diag,
            accessType:    dasd.access_type || "",
            partitionInfo: dasd.offline? ? "" : dasd.partition_info.to_s,
            status:        dasd.status.to_s,
            active:        !dasd.offline?,
            formatted:     dasd.formatted?
          }
        end

        # @return [Array<Hash>]
        def format_summary_json(format_statuses)
          format_statuses.map do |format_status|
            {
              channel:            format_status.dasd.id,
              totalCylinders:     format_status.cylinders,
              formattedCylinders: format_status.progress,
              finished:           format_status.done?
            }
          end
        end
      end
    end
  end
end
