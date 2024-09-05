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

require "dbus"
require "agama/dbus/base_object"

module Agama
  module DBus
    module Storage
      # Class representing the process of formatting a set of DASDs
      class DasdsFormatJob < BaseObject
        # Internal class to make easier to index the status information both by DASD id and by job
        # path, although in fact both are fully stable during the whole execution of the installer.
        #
        # This class helps to refresh the relationship between the DASD and its path every time a
        # status update is sent from the backend, although as already mentioned that wouldn't be
        # needed with the current implementation of the DASDs tree, since it keeps that relationship
        # stable.
        class DasdFormatInfo
          # @return [String] channel id of the DASD
          attr_accessor :id

          # @return [String] path of the DASD in the D-Bus tree
          attr_accessor :path

          # @return [Integer] total number of cylinders reported by the format operation
          attr_accessor :cylinders

          # @return [Integer] number of cylinders already processed by the format operation
          attr_accessor :progress

          # @return [Boolean] whether the disk is already fully formatted
          attr_accessor :done

          # Constructor
          #
          # @param status [Y2S390::FormatStatus]
          # @param dasds_tree [DasdsTree]
          def initialize(status, dasds_tree)
            @id = status.dasd.id
            @cylinders = status.cylinders
            @progress = status.progress
            @done = status.done?

            dbus_dasd = dasds_tree.find { |d| d.id == @id }
            if dbus_dasd
              @path = dbus_dasd.path
            else
              logger.warning "DASD is not longer in the D-BUS tree: #{status.inspect}"
            end
          end

          # Progress representation as expected by the D-Bus API (property Summary and signal
          # SummaryUpdated)
          def to_dbus
            [cylinders, progress, done]
          end
        end

        JOB_INTERFACE = "org.opensuse.Agama.Storage1.Job"
        private_constant :JOB_INTERFACE

        dbus_interface JOB_INTERFACE do
          dbus_reader(:running, "b")
          dbus_reader(:exit_code, "u")
          dbus_signal(:Finished, "exit_code:u")
        end

        DASD_FORMAT_INTERFACE = "org.opensuse.Agama.Storage1.DASD.Format"
        private_constant :DASD_FORMAT_INTERFACE

        dbus_interface DASD_FORMAT_INTERFACE do
          dbus_reader(:summary, "a{s(uub)}")
        end

        # @return [Boolean]
        attr_reader :running

        # @return [Integer] zero if still running
        attr_reader :exit_code

        # @return [Array<Y2390::Dasd>]
        attr_reader :dasds

        # Constructor
        #
        # @param initial [Array<Y2S390::FormatStatus>] initial status report from the format process
        # @param dasds_tree [DasdsTree] see #dasds_tree
        # @param path [DBus::ObjectPath] path in which the Job object is exported
        # @param logger [Logger, nil]
        def initialize(initial, dasds_tree, path, logger: nil)
          super(path, logger: logger)

          @exit_code = 0
          @running = true
          @dasds_tree = dasds_tree
          @infos = {}
          update_info(initial)
        end

        # Current status, in the format described by the D-Bus API
        def summary
          result = {}
          @infos.each_value { |i| result[i.id] = i.to_dbus if i.id }
          result
        end

        # Marks the job as finished
        #
        # @note A Finished and a PropertiesChanged signals are always emitted.
        #
        # @param exit_code [Integer]
        def finish_format(exit_code)
          @running = false
          @exit_code = exit_code
          Finished(exit_code)
          dbus_properties_changed(JOB_INTERFACE, interfaces_and_properties[JOB_INTERFACE], [])
        end

        # Updates the internal status information
        #
        # @note A SummaryUpdated signal is always emitted
        #
        # @param statuses [Array<Y2S390::FormatStatus] latest status update from the format process
        def update_format(statuses)
          return if statuses.empty?

          update_info(statuses)
          dbus_properties_changed(DASD_FORMAT_INTERFACE, { "Summary" => summary }, [])
        end

      private

        # @return [DasdsTree] D-Bus representation of the DASDs
        attr_reader :dasds_tree

        # @param statuses [Array<Y2S390::FormatStatus] latest status update from the format process
        def update_info(statuses)
          statuses.each do |status|
            info = DasdFormatInfo.new(status, dasds_tree)
            @infos[info.id] = info
          end
        end
      end
    end
  end
end
