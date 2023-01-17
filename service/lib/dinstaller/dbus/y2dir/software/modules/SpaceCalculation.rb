# Copyright (c) [2022] SUSE LLC
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

# :nodoc:
module Yast
  # Replacement for the Yast::SpaceCalculation module.
  class SpaceCalculationClass < Module
    def main
      puts "Loading mocked module #{__FILE__}"
    end

    # @see https://github.com/yast/yast-packager/blob/master/src/modules/SpaceCalculation.rb#L711
    def GetPartitionInfo; end

    # @see https://github.com/yast/yast-packager/blob/master/src/modules/SpaceCalculation.rb#L860
    def CheckDiskSize; true; end

    # @see https://github.com/yast/yast-packager/blob/master/src/modules/SpaceCalculation.rb#L894
    def CheckDiskFreeSpace(*_args); []; end

    # @see https://github.com/yast/yast-packager/blob/master/src/modules/SpaceCalculation.rb#L60
    def GetFailedMounts
      []
    end
  end

  SpaceCalculation = SpaceCalculationClass.new
  SpaceCalculation.main
end
