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
require "y2s390"
require "agama/storage/dasd/enable_operation"
require "agama/storage/dasd/disable_operation"
require "agama/storage/dasd/diag_operation"
require "agama/storage/dasd/format_operation"

module DInstaller
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

        # Constructor
        #
        # @param logger [Logger, nil]
        def initialize(logger: nil)
          @logger = logger || ::Logger.new($stdout)
          @devices = Y2S390::DasdsCollection.new([])

          @on_probe_callbacks = []
          @on_refresh_callbacks = []
        end

        # Reads the list of DASDs from the system
        #
        # Probe callbacks are called at the end, see {#on_probe}.
        def probe
          logger.info "Probing DASDs"
          @devices = reader.list(force_probing: true)
          # Initialize the attribute just in case the reader doesn't do it (see bsc#1209162)
          @devices.each { |d| d.diag_wanted = d.use_diag }
          logger.info("Probed DASDs #{@devices.inspect}")

          @on_probe_callbacks.each do |callback|
            callback.call(@devices)
          end
        end

        # Registers a callback to be called when the DASDs are probed
        #
        # @param block [Proc]
        def on_probe(&block)
          @on_probe_callbacks << block
        end

        # Registers a callback to be called when some DASDS are modified
        #
        # @param block [Proc]
        def on_refresh(&block)
          @on_refresh_callbacks << block
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

        # @return [Logger]
        attr_reader :logger

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

          @on_refresh_callbacks.each do |callback|
            callback.call(dasds)
          end
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
