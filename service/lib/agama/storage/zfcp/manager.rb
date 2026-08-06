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

require "agama/issue"
require "agama/storage/zfcp/config_importer"
require "agama/storage/zfcp/controller"
require "agama/storage/zfcp/device"
require "yast/i18n"
require "y2s390/zfcp"

module Agama
  module Storage
    module ZFCP
      # Manager for zFCP
      class Manager
        include Yast::I18n

        # @return [Array<Controller>]
        attr_reader :controllers

        # @return [Array<Device>]
        attr_reader :devices

        # Config according to the JSON schema.
        #
        # @return [Hash, nil] nil if not configured yet.
        attr_reader :config_json

        # @return [Array<Issue>]
        attr_reader :issues

        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @controllers = []
          @devices = []
          @issues = []
        end

        # Whether probing has been already performed.
        #
        # @return [Boolean]
        def probed?
          !!@probed
        end

        # Whether the given config was already successfully applied.
        #
        # @param config_json [Hash]
        # @return [Boolean]
        def configured?(config_json)
          issues.none? && self.config_json == config_json
        end

        # Probes zFCP
        def probe
          @probed = true
          probe_controllers
          probe_devices
        end

        # Applies the given zFCP config.
        #
        # @param config_json [Hash] Config according to the JSON schema.
        def configure(config_json)
          probe unless probed?

          @issues = []
          @config_json = config_json
          config = ConfigImporter.new(config_json).import

          configure_controllers(config)
          configure_devices(config)
        end

        # Whether the option for allowing automatic LUN scan (allow_lun_scan) is active
        #
        # Having allow_lun_scan active has some implications:
        #   * All LUNs are automatically activated when the controller is activated.
        #   * LUNs cannot be deactivated.
        #
        # @return [Boolean]
        def allow_lun_scan?
          yast_zfcp.allow_lun_scan?
        end

      private

        # @return [Logger]
        attr_reader :logger

        # @param channel [String]
        # @return [Controller, nil]
        def find_controller(channel)
          controllers.find { |c| c.channel == channel }
        end

        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        # @return [Device, nil]
        def find_device(channel, wwpn, lun)
          devices.find { |d| d.channel == channel && d.wwpn == wwpn && d.lun == lun }
        end

        # Probes the zFCP controllers.
        #
        # @return [Array<Controller>]
        def probe_controllers
          yast_zfcp.probe_controllers
          @controllers = yast_zfcp.controllers.map { |c| create_controller_from_record(c) }
        end

        # Probes the zFCP devices.
        #
        # Includes both active and inactive LUNs.
        #
        # @return [Array<Device>]
        def probe_devices
          @devices = find_all_luns.map { |channel, wwpn, lun| Device.new(channel, wwpn, lun) }
          yast_zfcp.probe_disks
          yast_zfcp.disks.each do |record|
            device = find_device_from_record(record)
            device&.active = true
            device&.device_name = record["dev_name"]
          end
        end

        # Configures the controllers.
        #
        # @param config [Config]
        def configure_controllers(config)
          return unless activate_controllers(config)

          # LUNs activation could delay after activating the controller. This usually happens when
          # activating a controller for first time because some SCSI initialization. Probing the
          # disks should be done after all disks are activated.
          #
          # FIXME: waiting 2 seconds should be enough, but there is no guarantee that all the
          # disks are actually activated.
          sleep(2)
          probe
        end

        # Configures the devices according to the config.
        #
        # @param config [Config]
        def configure_devices(config)
          activated_devices = activate_devices(config)
          deactivated_devices = deactivate_devices(config)
          devices_changed = activated_devices || deactivated_devices
          probe_devices if devices_changed
        end

        # Activates the controllers according to the config.
        #
        # @param config [Config]
        # @return [Booelan] Whether any controller was activated.
        def activate_controllers(config)
          channels = [
            config.controllers,
            config.devices.select(&:active?).map(&:channel)
          ].flatten.uniq

          channels
            .map { |c| activate_controller(c) }
            .any?
        end

        # Activates the controller if it is not active yet.
        #
        # @note: If "allow_lun_scan" is active, then all its LUNs are automatically activated.
        #
        # @param channel [String]
        # @return [Boolean] Whether the controller was activated.
        def activate_controller(channel)
          controller = find_controller(channel)
          return false if controller&.active?

          logger.info("Activating zFCP controller: #{channel}")
          output = yast_zfcp.activate_controller(channel)
          success = output["exit"] == 0
          return true if success

          @issues << Issue.new(
            # TRANSLATORS: %s is replaced by a zFCP channel (e.g., "0.0.5223").
            format(_("The zFCP controller %s cannot be activated"), channel),
            kind: :zfcp_controller_activation
          )

          false
        end

        # Activates the devices according to the config.
        #
        # @param config [Config]
        # @return [Booelan] Whether any device was activated.
        def activate_devices(config)
          config.devices
            .select(&:active?)
            .map { |d| activate_device(d.channel, d.wwpn, d.lun) }
            .any?
        end

        # Activates a device if it is not active yet.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Boolean] Whether the device was activated.
        def activate_device(channel, wwpn, lun)
          device = find_device(channel, wwpn, lun)
          return false if device&.active?

          logger.info("Activating zFCP device: #{channel} #{wwpn} #{lun}")
          output = yast_zfcp.activate_disk(channel, wwpn, lun)
          success = output["exit"] == 0
          return true if success

          @issues << Issue.new(
            # TRANSLATORS: %s is replaced by a zFCP device (e.g.,
            #   "0.0.5223 0x500507681015a2b2 0x0186000000000000").
            format(_("The zFCP device %s cannot be activated"), "#{channel} #{wwpn} #{lun}"),
            kind: :zfcp_lun_activation
          )

          false
        end

        # Deactivates the devices according to the config.
        #
        # @param config [Config]
        # @return [Booelan] Whether any device was deactivated.
        def deactivate_devices(config)
          config.devices
            .reject(&:active?)
            .map { |d| deactivate_device(d.channel, d.wwpn, d.lun) }
            .any?
        end

        # Deactivates a device if it is active.
        #
        # @note: If the disk is unknown or "allow_lun_scan" is active, then the disk deactivation
        #   is not performed (noop).
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Boolean] Whether the device was deactivated.
        def deactivate_device(channel, wwpn, lun)
          device = find_device(channel, wwpn, lun)
          return false unless device&.active?

          controller = find_controller(channel)
          return false if controller&.lun_scan?

          logger.info("Deactivating zFCP device: #{channel} #{wwpn} #{lun}")
          output = yast_zfcp.deactivate_disk(channel, wwpn, lun)
          success = output["exit"] == 0
          return true if success

          @issues << Issue.new(
            # TRANSLATORS: %s is replaced by a zFCP device (e.g.,
            #   "0.0.5223 0x500507681015a2b2 0x0186000000000000").
            format(_("The zFCP device %s cannot be deactivated"), "#{channel} #{wwpn} #{lun}"),
            kind: :zfcp_lun_deactivation
          )

          false
        end

        # Creates a zFCP controller from a YaST record.
        #
        # @param record [Hash]
        # @return [Controller]
        def create_controller_from_record(record)
          Controller.new(record["sysfs_bus_id"]).tap do |controller|
            controller.active = yast_zfcp.activated_controller?(controller.channel)
            controller.lun_scan = yast_zfcp.lun_scan_controller?(controller.channel)
            controller.wwpns = find_wwpns(controller)
          end
        end

        # Finds a zFCP device from a YaST record.
        #
        # @param record [Hash]
        # @return [Device, nil]
        def find_device_from_record(record)
          channel = record.dig("detail", "controller_id")
          wwpn = record.dig("detail", "wwpn")
          lun = record.dig("detail", "fcp_lun")
          find_device(channel, wwpn, lun)
        end

        # Finds the WWPNs of the given controller.
        #
        # @param controller [Controller]
        # @return [Array<String>]
        def find_wwpns(controller)
          return [] unless controller.active?

          output = yast_zfcp.find_wwpns(controller.channel)
          output["stdout"]
        end

        # Finds the LUNs of all active controllers.
        #
        # @return [Array<Array<String, String, String>] List of [channel, WWPN, LUN].
        def find_all_luns
          controllers.select(&:active?).flat_map { |c| find_controller_luns(c) }
        end

        # Finds the LUNs of the given controller.
        #
        # @return [Array<Array<String, String, String>] List of [channel, WWPN, LUN].
        def find_controller_luns(controller)
          return [] unless controller.active?

          channel = controller.channel
          controller.wwpns.flat_map { |w| find_luns(channel, w).map { |l| [channel, w, l] } }
        end

        # Finds the LUNs for the given channel and WWPN.
        #
        # @param channel [String]
        # @param wwpn [String]
        #
        # @return [Array<String>]
        def find_luns(channel, wwpn)
          output = yast_zfcp.find_luns(channel, wwpn)
          output["stdout"]
        end

        # YaST object to manage zFCP devices
        #
        # @return [Y2S390::ZFCP]
        def yast_zfcp
          @yast_zfcp ||= Y2S390::ZFCP.new
        end
      end
    end
  end
end
