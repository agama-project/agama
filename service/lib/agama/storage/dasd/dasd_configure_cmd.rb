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

module DInstaller
  module Storage
    module DASD
      # Class used to invoke the dasd_configure command traditionally used during (open)SUSE
      # installations to manage DASDs
      class DasdConfigureCmd
        def initialize(dasd)
          @dasd = dasd
        end

        # Executes the command to set the device online
        def enable
          command = ["dasd_configure", dasd.id, "1", diag_argument]
          # An exit code of 8 means the disk was indeed enabled but it's not formatted.
          # We don't consider that to be a problem.
          Yast::Execute.locally!(command, allowed_exitstatus: [0, 8])
          true
        rescue Cheetah::ExecutionFailed
          false
        end

        # Executes the command to set the device offline
        def disable
          # If the device is in use, chzdev (which is called by dasd_configure) interactively
          # asks whether to continue. We use an empty string at stdin as a mechanism to reply
          # the default 'no'.
          command = ["dasd_configure", dasd.id, "0"]
          Yast::Execute.locally!(command, stdin: "")
          true
        rescue Cheetah::ExecutionFailed
          false
        end

      private

        # @return [Y2S390::Dasd]
        attr_reader :dasd

        # @see #enable
        def diag_argument
          dasd.diag_wanted ? "1" : "0"
        end
      end
    end
  end
end
