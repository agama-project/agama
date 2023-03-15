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

module DInstaller
  module Storage
    module DASD
      # Operation to format the given set of DASDs
      #
      # TODO: we plan to change the approach to DASD formatting, so this class will change
      # very soon.
      class FormatOperation
        # Constructor
        #
        # @param dasds [Array<Y2S390:Dasd>] devices to format
        def initialize(dasds)
          @process = Y2S390::FormatProcess.new(dasds)
        end

        # Formats all the given DASDs
        #
        # NOTE: this algorithm is pretty much copied from Y2S390::Dialogs::FormatDialog
        #
        # @return [Boolean] true if the operation succeeds for all the DASDs
        def run
          # NOTE: Does a device need to be reactivated after formating it?
          #       The code at DasdActions::Activate seems to imply that
          #       But the code at DasdActions::Format contains a comment stating otherwise
          return false unless start?

          process.initialize_summary
          while process.running?
            process.update_summary
            # TODO: trigger a callback to notify the process status information
            sleep(0.2)
          end
          # TODO: maybe trigger a callback to notify the final status?

          process.status.to_i.zero?
        end

      private

        # Object to manage the process
        #
        # @return [Y2S390::FormatProcess]
        attr_reader :process

        # Starts the formatting process
        #
        # @return [Boolean] true if the process was succesfully started
        def start?
          process.start
          sleep(0.2)
          process.running?
        end
      end
    end
  end
end
