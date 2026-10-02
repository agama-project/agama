# Copyright (c) [2018] SUSE LLC
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

module Y2Storage
  module Proposal
    # This class holds information about a device which has a smaller size than
    # planned.
    #
    # @see Y2Storage::Proposal::AutoinstCreatorResult
    DeviceShrinkage = Struct.new(:planned, :real) do
      # Size difference between planned and real device
      #
      # @return [DiskSize]
      def diff
        Y2Storage::DiskSize.new(planned.min_size.to_i - real.size.to_i)
      end
    end
  end
end
