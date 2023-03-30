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

require "agama/storage/dasd/sequential_operation"
require "agama/storage/dasd/dasd_configure_cmd"

module Agama
  module Storage
    module DASD
      # Operation to enable a set of DASDs
      class EnableOperation < SequentialOperation
      private

        def process_dasd(dasd)
          # We considered to stop using dasd_configure in favor of directly calling "chzdev -e".
          # That would allow us, for example, to enable all the devices with a single command.
          # But dasd_configure does a couple of extra things we still find valuable:
          #   - It checks whether the device really goes online, using a reasonable timeout
          #   - It writes the CIO channel of the device to /boot/zipl/active_devices.txt (we are
          #     not sure whether this is relevant in our case, bsc#1095033 seems to suggest it is).
          DasdConfigureCmd.new(dasd).enable
        end
      end
    end
  end
end
