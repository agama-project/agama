# Copyright (c) [2018-2023] SUSE LLC
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

require "y2storage/proposal/space_maker_prospects/base"

module Y2Storage
  module Proposal
    module SpaceMakerProspects
      # Represents the prospect action of deleting the content of a disk with no
      # partition table (i.e. a disk that is directly formatted or is a
      # component of a software RAID or an LVM).
      #
      # @see Base
      class WipeDisk < Base
        protected

        # @see #action
        def action_class
          SpaceMakerActions::Wipe
        end
      end
    end
  end
end
