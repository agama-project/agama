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
        # Config according to the JSON schema.
        #
        # @return [Hash, nil]
        attr_reader :config_json

        # All known DASDs
        #
        # @return [Y2S390::DasdsCollection]
        attr_reader :devices

        # Constructor
        #
        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @devices = Y2S390::DasdsCollection.new([])
        end

        # Whether probing has been already performed.
        #
        # @return [Boolean]
        def probed?
          !!@probed
        end

        # Reads the list of DASDs from the system
        #
        # Probe callbacks are called at the end, see {#on_probe}.
        def probe
          @probed = true
          @devices = reader.list(force_probing: true)
          # Initialize the attribute just in case the reader doesn't do it (see bsc#1209162)
          @devices.each { |d| d.diag_wanted = d.use_diag }
          # Devices are locked if they are already enabled at the time of probing for first time.
          @locked_devices ||= @devices.reject(&:offline?).map(&:id)
        end

        # Applies the given DASD config.
        #
        # @param config_json [Hash{Symbol=>Object}] Config according to the JSON schema.
        def configure(config_json)
          probe unless probed?
          @config_json = config_json

          # TODO: remove locked if belongs to config

          config = ConfigImporter.new(config_json).import

          activate_devices(config)
          deactivate_devices(config)
          format_devices(config)
        end

        # Whether the system is already configured for the given config.
        #
        # @param config_json [Hash]
        # @return [Boolean]
        def configured?(config_json)
          self.config_json == config_json
        end

        # Whether the given device is locked.
        #
        # @param dasd [Y2S390::Dasd]
        # @return [Boolean]
        def device_locked?(dasd)
          locked_devices&.include?(dasd.id) || false
        end

        # The DASD type (ECKD, FBA)
        #
        # @param dasd [Y2S390::Dasd]
        # @return [String] empty if unknown
        def device_type(dasd)
          dasd.type || type_from(dasd)
        end

        # Enables the given list of DASDs
        #
        # Refresh callbacks are called at the end, see {#on_refresh}.
        #
        # NOTE: see note about use_diag at this class description.
        #
        # @param devices [Array<Y2S390::Dasd>]
        # @return [Boolean] true if all the given devices were enabled
        def enable(devices)
          refresh_after(devices) { EnableOperation.new(devices, logger).run }
        end

        # Disables the given list of DASDs
        #
        # Refresh callbacks are called at the end, see {#on_refresh}.
        #
        # @param devices [Array<Y2S390::Dasd>]
        # @return [Boolean] true if all the given devices were disabled
        def disable(devices)
          refresh_after(devices) { DisableOperation.new(devices, logger).run }
        end

        # Sets the value of the use_diag flag for the given list of DASDs
        #
        # Refresh callbacks are called at the end, see {#on_refresh}.
        #
        # NOTE: see note about management of the use_diag flag at this class description.
        #
        # @param devices [Array<Y2S390::Dasd>]
        # @param diag [Boolean] value of the flag
        # @return [Boolean] true if the flag is successfully set for all the given devices
        def set_diag(devices, diag)
          refresh_after(devices) { DiagOperation.new(devices, logger, diag).run }
        end

        # Formats the given list of DASDs
        #
        # @param devices [Array<Y2S390::Dasd>]
        # @return [Boolean] true if all the given devices were successfully formatted
        def format(devices, on_progress: nil, on_finish: nil)
          progress = []
          finish = [proc { |_status| refresh(devices) }]
          progress << on_progress if on_progress
          finish << on_finish if on_finish
          FormatOperation.new(devices, progress, finish).run
        end

      private

        ECKD = "ECKD"
        FBA = "FBA"
        private_constant :ECKD, :FBA

        # @return [Logger]
        attr_reader :logger

        # List of ids of the locked devices.
        #
        # @return [Array<String>, nil]
        attr_reader :locked_devices

        # Return the type from the device type
        #
        # @see https://github.com/SUSE/s390-tools/blob/master/dasd_configure#L162
        #
        # @param dasd [Y2S390::Dasd]
        # @return [String]
        def type_from(dasd)
          # The DASD device type concatenating the cutype and devtype (i.e. 3990/E9 3390/0A)
          device_type = dasd.device_type || ""

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

        # Updates the attributes of the given DASDs with the current information read from the
        # system
        #
        # Refresh callbacks are called at the end, see {#on_refresh}.
        #
        # @param dasds [Array<Y2S390::Dasd>] devices to update
        def refresh(dasds)
          logger.info "Refreshing DASDs"
          dasds.each { |dev| reader.update_info(dev, extended: true) }
          logger.info "Refreshed DASDs #{dasds.inspect}"
        end

        # Calls the given block and performs a refresh of the affected DASDs afterwards
        #
        # @note Returns the result of the block.
        # @param devices [Array<Y2S390::Dasd>]
        # @param block [Proc]
        def refresh_after(devices, &block)
          block.call.tap { refresh(devices) }
        end
      end
    end
  end
end
