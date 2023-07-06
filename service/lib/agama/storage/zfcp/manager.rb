# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "yast"
require "y2s390/zfcp"
require "y2storage/storage_manager"
require "agama/storage/zfcp/controller"
require "agama/storage/zfcp/disk"

module Agama
  module Storage
    module ZFCP
      # Manager for zFCP
      class Manager
        # Constructor
        #
        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
        end

        # Registers a callback to be called when the zFCP is probed
        #
        # @param block [Proc]
        def on_probe(&block)
          @on_probe_callbacks ||= []
          @on_probe_callbacks << block
        end

        # Registers a callback to be called when the zFCP disks change
        #
        # @param block [Proc]
        def on_disks_change(&block)
          @on_disks_change_callbacks ||= []
          @on_disks_change_callbacks << block
        end

        # Probes zFCP
        #
        # Callbacks {#on_probe} are called after probing, and callbacks {#on_disks_change} are
        # called if there is any change in the disks.
        def probe
          logger.info "Probing zFCP"

          previous_disks = disks
          yast_zfcp.probe_controllers
          yast_zfcp.probe_disks

          @on_probe_callbacks&.each { |c| c.call(controllers, disks) }

          return unless disks_changed?(previous_disks)

          @on_disks_change_callbacks&.each { |c| c.call(disks) }
        end

        # zFCP controllers
        #
        # @return [Array<Controller>]
        def controllers
          yast_zfcp.controllers.map { |c| controller_from(c) }
        end

        # Current active zFCP disks
        #
        # @return [Array<Disk>]
        def disks
          yast_zfcp.disks.map { |d| disk_from(d) }
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

        # Activates the controller with the given channel id
        #
        # @note: If "allow_lun_scan" is active, then all its LUNs are automatically activated.
        #
        # @param channel [String]
        # @return [Integer] Exit code of the chzdev command (0 on success)
        def activate_controller(channel)
          output = yast_zfcp.activate_controller(channel)
          if output["exit"] == 0
            # LUNs activation could delay after activating the controller. This usually happens when
            # activating a controller for first time because some SCSI initialization. Probing the
            # disks should be done after all disks are activated.
            #
            # FIXME: waiting 2 seconds should be enough, but there is no guarantee that all the
            # disks are actually activated.
            sleep(2)
            probe
          end
          output["exit"]
        end

        # Activates a zFCP disk
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Integer] Exit code of the chzdev command (0 on success)
        def activate_disk(channel, wwpn, lun)
          output = yast_zfcp.activate_disk(channel, wwpn, lun)
          probe if output["exit"] == 0
          output["exit"]
        end

        # Deactivates a zFCP disk
        #
        # @note: If "allow_lun_scan" is active, then the disk cannot be deactivated.
        #
        # @param channel [String]
        # @param wwpn [String]
        # @param lun [String]
        #
        # @return [Integer] Exit code of the chzdev command (0 on success)
        def deactivate_disk(channel, wwpn, lun)
          output = yast_zfcp.deactivate_disk(channel, wwpn, lun)
          probe if output["exit"] == 0
          output["exit"]
        end

        # Finds the WWPNs for the given channel
        #
        # @param channel [String]
        # @return [Array<String>]
        def find_wwpns(channel)
          output = yast_zfcp.find_wwpns(channel)
          output["stdout"]
        end

        # Finds the LUNs for the given channel and WWPN
        #
        # @param channel [String]
        # @param wwpn [String]
        #
        # @return [Array<String>]
        def find_luns(channel, wwpn)
          output = yast_zfcp.find_luns(channel, wwpn)
          output["stdout"]
        end

      private

        # @return [Logger]
        attr_reader :logger

        # Whether threre is any change in the disks
        #
        # Checks whether any of the removed disks is still probed or whether any of the current
        # disks is not probed yet.
        #
        # @param previous_disks [Array<Disk>] Previously activated disks (before zFCP (re)probing)
        # @return [Booelan]
        def disks_changed?(previous_disks)
          removed_disks = previous_disks - disks

          return true if removed_disks.any? { |d| exist_disk?(d) }
          return true if disks.any? { |d| !exist_disk?(d) }

          false
        end

        # Whether the given disk is probed
        #
        # @param disk [Disk]
        # @return [Booelan]
        def exist_disk?(disk)
          !Y2Storage::StorageManager.instance.probed.find_by_name(disk.name).nil?
        end

        # Creates a zFCP controller from YaST data
        #
        # @param record [Hash]
        # @return [Controller]
        def controller_from(record)
          Controller.new(record["sysfs_bus_id"]).tap do |controller|
            controller.active = yast_zfcp.activated_controller?(controller.channel)
            controller.lun_scan = yast_zfcp.lun_scan_controller?(controller.channel)
          end
        end

        # Creates a zFCP disk from YaST data
        #
        # @param record [Hash]
        # @return [Disk]
        def disk_from(record)
          device = record["dev_name"]
          channel = record.dig("detail", "controller_id")
          wwpn = record.dig("detail", "wwpn")
          lun = record.dig("detail", "fcp_lun")

          Disk.new(device, channel, wwpn, lun)
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
