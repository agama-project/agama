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

require "yast"
require "y2s390"
require "agama/storage/dasd/enable_operation"
require "agama/storage/dasd/config_importer"
require "agama/storage/dasd/disable_operation"
require "agama/storage/dasd/diag_operation"
require "agama/storage/dasd/format_operation"

module Agama
  module Storage
    module DASD
      # Manager for configuring DASDs (Direct-Access Storage Devices)
      #
      # NOTE: this mimics to a big extent the YaST behavior regarding the management of the
      # use_diag flag for a given DASD. YaST behavior have the following particularities:
      #
      #   - When the value of the DIAG flag is changed for an enabled device, the change is applied
      #     immediately, disabling the device and enabling it again with the new value.
      #   - When the value of DIAG is changed for a disabled device, the new wanted value is stored
      #     by YaST in memory but not written to the system configuration. The change will only
      #     have effect if the device is enabled afterwards during the same YaST execution (lost
      #     if YaST quits without ever enabling the device).
      #   - In the UI, DIAG is always displayed as 'no' for disabled devices. For enabled devices
      #     the correct/current value is displayed.
      class Manager
        # All known DASDs
        #
        # @return [Y2S390::DasdsCollection]
        attr_reader :devices

        # Config according to the JSON schema.
        #
        # @return [Hash, nil] nil if not configured yet.
        attr_reader :config_json

        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @devices = Y2S390::DasdsCollection.new([])
          @configured = false
        end

        # Whether probing has been already performed.
        #
        # @return [Boolean]
        def probed?
          !!@probed
        end

        # Reads the list of DASDs from the system.
        def probe
          @probed = true
          # Considering as not configured in order to make possible to reapply the same config after
          # probing. This is useful when the config contains some missing dasd, and such a dasd
          # appears after a reprobing.
          @configured = false
          @devices = reader.list(force_probing: true)
          # Initialize the attribute just in case the reader doesn't do it (see bsc#1209162)
          @devices.each { |d| d.diag_wanted = d.use_diag }
          # Devices are locked if they are already enabled at the time of probing for first time.
          @locked_devices ||= @devices.reject(&:offline?).map(&:id)
          true
        end

        # Applies the given DASD config.
        #
        # @param config_json [Hash{Symbol=>Object}] Config according to the JSON schema.
        def configure(config_json)
          probe unless probed?

          @configured = true
          @config_json = config_json
          config = ConfigImporter.new(config_json).import

          activate_devices(config)
          deactivate_devices(config)
          format_devices(config)
          enable_diag(config)
          disable_diag(config)
        end

        # Whether the system is already configured for the given config.
        #
        # @param config_json [Hash]
        # @return [Boolean]
        def configured?(config_json)
          @configured && self.config_json == config_json
        end

        # The DASD type (ECKD, FBA)
        #
        # @param dasd [Y2S390::Dasd]
        # @return [String] empty if unknown
        def device_type(dasd)
          dasd.type || type_from(dasd)
        end

        # @param block [Proc]
        def on_format_change(&block)
          @on_format_change_callbacks ||= []
          @on_format_change_callbacks << block
        end

        # @param block [Proc]
        def on_format_finish(&block)
          @on_format_finish_callbacks ||= []
          @on_format_finish_callbacks << block
        end

      private

        ECKD = "ECKD"
        FBA = "FBA"
        private_constant :ECKD, :FBA

        # @return [Logger]
        attr_reader :logger

        # Activates DASDs devices.
        #
        # @param config [Config]
        # @return [Array<Y2S390::Dasd>] Activated devices.
        def activate_devices(config)
          devices = config.devices
            .select(&:active?)
            .map { |d| find_device(d.channel) }
            .compact
            .reject(&:active?)

          return [] if devices.empty?

          logger.info("Activating DASDs: #{devices}")
          EnableOperation.new(devices, logger).run
          update_configured_devices(devices)
        end

        # Deactivates DASDs devices.
        #
        # @param config [Config]
        # @return [Array<Y2S390::Dasd>] Deactivated devices.
        def deactivate_devices(config)
          # Explictly deactivated devices.
          deactivated_devices = config.devices
            .reject(&:active?)
            .map { |d| find_device(d.channel) }
            .compact

          # Devices that are not included in the config and are not locked.
          missing_devices = devices
            .reject { |d| device_locked?(d) }
            .reject { |d| config.include_device?(d.id) }

          devices = deactivated_devices
            .concat(missing_devices)
            .uniq
            .select(&:active?)

          return [] if devices.empty?

          logger.info("Deactivating DASDs: #{devices}")
          DisableOperation.new(devices, logger).run
          update_configured_devices(devices)
        end

        # Formats DASDs devices.
        #
        # @param config [Config]
        # @return [Array<Y2S390::Dasd>] Formatted devices.
        def format_devices(config)
          devices = config.devices
            .select(&:active?)
            .select { |d| format_device?(d) }
            .map { |d| find_device(d.channel) }
            .compact

          return [] if devices.empty?

          logger.info("Formatting DASDs: #{devices}")

          progress = @on_format_change_callbacks || []
          finish = @on_format_finish_callbacks || []
          FormatOperation.new(devices, progress, finish).run
          update_configured_devices(devices)
        end

        # Enables DIAG option.
        #
        # @param config [Config]
        # @return [Array<Y2S390::Dasd>] Configured devices.
        def enable_diag(config)
          devices = config.devices
            .select(&:active?)
            .select { |d| d.diag_action == Configs::Device::DiagAction::ENABLE }
            .map { |d| find_device(d.channel) }
            .compact
            .reject(&:use_diag)

          return [] if devices.empty?

          logger.info("Enabling DIAG: #{devices}")
          DiagOperation.new(devices, logger, true).run
          update_configured_devices(devices)
        end

        # Disables DIAG option.
        #
        # @param config [Config]
        # @return [Array<Y2S390::Dasd>] Configured devices.
        def disable_diag(config)
          devices = config.devices
            .select(&:active?)
            .select { |d| d.diag_action == Configs::Device::DiagAction::DISABLE }
            .map { |d| find_device(d.channel) }
            .compact
            .select(&:use_diag)

          return [] if devices.empty?

          logger.info("Disabling DASDs: #{devices}")
          DiagOperation.new(devices, logger, false).run
          update_configured_devices(devices)
        end

        # Updates the information about the configured devices.
        #
        # @param devices [Array<Y2S390::Dasd>]
        def update_configured_devices(devices)
          refresh_devices(devices)
          unlock_devices(devices)
        end

        # Updates the attributes of the given DASDs with the current information read from the
        # system.
        #
        # @param devices [Array<Y2S390::Dasd>] Devices to update.
        def refresh_devices(devices)
          devices.each { |d| reader.update_info(d, extended: true) }
        end

        # Removes the given devices from the list of locked devices.
        #
        # @param devices [Array<Y2S390::Dasd>]
        def unlock_devices(devices)
          return unless @locked_devices

          devices.each { |d| @locked_devices.delete(d.id) }
        end

        # Whether the given device is locked.
        #
        # @param device [Y2S390::Dasd]
        # @return [Boolean]
        def device_locked?(device)
          @locked_devices&.include?(device.id) || false
        end

        # Whether the device has to be formatted.
        #
        # @param device_config [Configs::Device]
        # @return [Boolean]
        def format_device?(device_config)
          return false if device_config.format_action == Configs::Device::FormatAction::NONE

          device = find_device(device_config.channel)
          return false unless device

          !device.formatted? || device_config.format_action == Configs::Device::FormatAction::FORMAT
        end

        # Finds a DASD device with the given channel.
        #
        # @param channel [String]
        # @return [Y2S390::Dasd, nil]
        def find_device(channel)
          devices.find { |d| d.id == channel }
        end

        # Returns the type from the device.
        #
        # @see https://github.com/SUSE/s390-tools/blob/master/dasd_configure#L162
        #
        # @param device [Y2S390::Dasd]
        # @return [String]
        def type_from(device)
          # The DASD device type concatenating the cutype and devtype (i.e. 3990/E9 3390/0A)
          device_type = device.device_type || ""

          cu_type, dev_type = device_type.split
          return ECKD if cu_type.to_s.start_with?("3990", "2105", "2107", "1750", "9343")
          return FBA if cu_type.to_s.start_with?("6310")

          if cu_type.start_with?("3880")
            return ECKD if dev_type.start_with?("3390")
            return FBA if dev_type.start_with?("3370")
          end

          device_type
        end

        # @return [Y2S390::DasdsReader]
        def reader
          @reader ||= Y2S390::DasdsReader.new
        end
      end
    end
  end
end
