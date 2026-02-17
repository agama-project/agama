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

require "y2s390/zfcp"
require "agama/storage/zfcp/config_importer"
require "agama/storage/zfcp/controller"
require "agama/storage/zfcp/device"

module Agama
  module Storage
    module ZFCP
      # Manager for zFCP
      class Manager
        # @return [Array<Controller>]
        attr_reader :controllers

        # @return [Array<Device>]
        attr_reader :devices

        # Config according to the JSON schema.
        #
        # @return [Hash, nil] nil if not configured yet.
        attr_reader :config_json

        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @controllers = []
          @devices = []
        end

        # Whether probing has been already performed.
        #
        # @return [Boolean]
        def probed?
          !!@probed
        end

        # Probes zFCP
        def probe
          @probed = true
          probe_controllers
          probe_devices
        end

        # Applies the given zFCP config.
        #
        # @param config_json [Hash{Symbol=>Object}] Config according to the JSON schema.
        # @return [boolean] Whether the system has changed.
        def configure(config_json)
          probe unless probed?

          @config_json = config_json
          config = ConfigImporter.new(config_json).import

          system_changed = configure_controllers(config)
          system_changed ||= configure_devices(config)
          system_changed
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

        # @return [Array<Controller>]
        def probe_controllers
          yast_zfcp.probe_controllers
          @controllers = yast_zfcp.controllers.map { |c| create_controller_from_record(c) }
        end

        # Probes the zFCP devices from all channels and WWPNs.
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

        # @param config [Config]
        # @return [Booelan] Whether any controller was activated.
        def configure_controllers(config)
          controllers_changed = activate_controllers(config)

          return false unless controllers_changed

          # LUNs activation could delay after activating the controller. This usually happens when
          # activating a controller for first time because some SCSI initialization. Probing the
          # disks should be done after all disks are activated.
          #
          # FIXME: waiting 2 seconds should be enough, but there is no guarantee that all the
          # disks are actually activated.
          sleep(2)
          probe
          true
        end

        # @param config [Config]
        # @return [Booelan] Whether any controller was activated.
        def activate_controllers(config)
          config.controllers
            .select(&:active?)
            .reject { |c| activated_controller?(c.channel) }
            .map { |c| activate_controller(c.channel) }
            .any?(0)
        end

        # @param config [Config]
        # @return [Boolean] Whether any device was activated or deactivated.
        def configure_devices(config)
          devices_changed = activate_devices(config)
          devices_chaged ||= deactivate_devices(config)
          probe if devices_changed
          devices_changed
        end

        # @param config [Config]
        # @return [Booelan] Whether any device was activated.
        def activate_devices(config)
          config.devices
            .select(&:active?)
            .reject { |d| activated_device?(d.channel, d.wwpn, d.lun) }
            .map { |d| activate_device(d.channel, d.wwpn, d.lun) }
            .any?(0)
        end

        # @param config [Config]
        # @return [Booelan] Whether any device was deactivated.
        def deactivate_devices(config)
          config.devices
            .reject(&:active?)
            .reject { |d| deactivated_device?(d.channel, d.wwpn, d.lun) }
            .map { |d| deactivate_device(d.channel, d.wwpn, d.lun) }
            .any?(0)
        end

        # Activates the controller with the given channel id.
        #
        # @note: If "allow_lun_scan" is active, then all its LUNs are automatically activated.
        #
        # @param channel [String]
        # @return [Integer] Exit code of the chzdev command (0 on success)
        def activate_controller(channel)
          logger.info("Activating zFCP controller #{channel}")
          output = yast_zfcp.activate_controller(channel)
          exit = output["exit"]
          logger.warn("zFCP controller #{channel} could not be activated") unless exit == 0
          exit
        end

        # Activates a zFCP disk.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        # @return [Integer] Exit code of the chzdev command (0 on success)
        def activate_device(channel, wwpn, lun)
          logger.info("Activating zFCP device #{[channel, wwpn, lun]}")
          output = yast_zfcp.activate_disk(channel, wwpn, lun)
          exit = output["exit"]
          logger.warn("zFCP device #{[channel, wwpn, lun]} could not be activated") unless exit == 0
          exit
        end

        # Deactivates a zFCP disk.
        #
        # @note: If "allow_lun_scan" is active, then the disk cannot be deactivated.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        # @return [Integer] Exit code of the chzdev command (0 on success)
        def deactivate_device(channel, wwpn, lun)
          logger.info("Deactivating zFCP device #{[channel, wwpn, lun]}")
          output = yast_zfcp.deactivate_disk(channel, wwpn, lun)
          exit = output["exit"]
          logger.warn("zFCP device #{[channel, wwpn, lun]} could not be deactivated") if exit != 0
          exit
        end

        # Creates a zFCP controller from a YaST record.
        #
        # @param record [Hash]
        # @return [Controller]
        def create_controller_from_record(record)
          Controller.new(record["sysfs_bus_id"]).tap do |controller|
            controller.active = yast_zfcp.activated_controller?(controller.channel)
            controller.lun_scan = yast_zfcp.lun_scan_controller?(controller.channel)
            controller.wwpns = find_wwpns(controller.channel)
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

        # Whether there is an active probed controller with the given channel.
        #
        # @param channel [String]
        # @return [Boolean]
        def activated_controller?(channel)
          controller = find_controller(channel)
          !controller.nil && controller.active?
        end

        # Whether there is an active probed device.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        # @return [Boolean]
        def activated_device?(channel, wwpn, lun)
          device = find_device(channel, wwpn, lun)
          !device.nil && device.active?
        end

        # Whether there is a deactivated probed device.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        # @return [Boolean]
        def deactivated_device?(channel, wwpn, lun)
          device = find_device(channel, wwpn, lun)
          !device.nil? && !device.active?
        end

        # Finds the WWPNs for the given channel.
        #
        # @param channel [String]
        # @return [Array<String>]
        def find_wwpns(channel)
          output = yast_zfcp.find_wwpns(channel)
          output["stdout"]
        end

        # Finds the LUNs from all channels and WWPNs.
        #
        # @return [Array<Array<String, String, String>] List of [channel, WWPN, LUN].
        def find_all_luns
          controllers.flat_map { |c| find_controller_luns(c) }
        end

        # Finds the LUNs from all the WWPNs of given controller.
        #
        # @return [Array<Array<String, String, String>] List of [channel, WWPN, LUN].
        def find_controller_luns(controller)
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
