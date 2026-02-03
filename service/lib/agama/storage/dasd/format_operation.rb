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
require "y2s390/format_process"

module Agama
  module Storage
    module DASD
      # Operation to format the given set of DASDs
      class FormatOperation
        # Constructor
        #
        # @param dasds [Array<Y2S390:Dasd>] devices to format
        # @param on_progress [Array<Proc>] callbacks to be called when the status of the operation
        #   is refreshed
        # @param on_finish [Array<Proc>] callbacks to be called when the operation ends
        def initialize(dasds, on_progress = [], on_finish = [])
          @process = Y2S390::FormatProcess.new(dasds)
          @on_progress = on_progress
          @on_finish = on_finish
        end

        # Starts a format process on the given DASDs
        #
        # NOTE: Does a device need to be reactivated after formating it? The code at
        # DasdActions::Activate seems to imply that, but the code at DasdActions::Format contains a
        # comment stating otherwise. Let's do nothing for the time being.
        #
        # @return [Boolean] false if the format process couldn't be started.
        def run
          return false unless start?

          process.initialize_summary
          # Just to be absolutely sure, sleep to ensure the #run method returns and its result is
          # processed by the caller before we start calling callbacks
          wait
          monitor_process
          true
        end

      private

        # Object to manage the process
        #
        # @return [Y2S390::FormatProcess]
        attr_reader :process

        # Seconds between queries (including the first one) to the dasdformat command... and thus,
        # between subsequent progress updates.
        WAIT_TIME = 1
        private_constant :WAIT_TIME

        def wait
          sleep(WAIT_TIME)
        end

        # Starts the formatting process
        #
        # @return [Boolean] true if the process was succesfully started
        def start?
          process.start
          wait
          process.running?
        end

        def monitor_process
          while process.running?
            update_status
            wait
          end
          update_status
          @on_finish.each { |p| p.call(process.status) }
        end

        def update_status
          process.update_summary
          @on_progress.each { |p| p.call(process.updated.values) }
        end
      end
    end
  end
end
