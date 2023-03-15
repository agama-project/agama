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

require "yast2/execute"
require "dinstaller/storage/dasd/sequential_operation"
require "dinstaller/storage/dasd/dasd_configure_cmd"

module DInstaller
  module Storage
    module DASD
      # Operation to set the use_diag flag for a group of DASDs
      #
      # Management of that flag in YaST is a bit weird, but we decided to emulate it to a big extent
      # to keep the known behavior. Check DInstaller::Storage::DASD::Manager for more information.
      class DiagOperation < SequentialOperation
        # Constructor
        def initialize(dasds, logger, value)
          super(dasds, logger)
          @value = value
        end

      private

        # @return [Boolean] newly wanted value for the use_diag flag
        attr_reader :value

        def process_dasd(dasd)
          dasd.diag_wanted = value
          return true if dasd.offline?
          return true if dasd.diag_wanted == dasd.use_diag

          dasd_configure = DasdConfigureCmd.new(dasd)
          dasd_configure.disable && dasd_configure.enable
        rescue Cheetah::ExecutionFailed
          false
        end
      end
    end
  end
end
