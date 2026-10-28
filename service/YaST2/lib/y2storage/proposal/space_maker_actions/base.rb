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

module Y2Storage
  module Proposal
    module SpaceMakerActions
      # Class to represent an action to be performed by SpaceMaker on the system
      #
      # Objects of this class can be originated from SpaceMaker prospects (if the actions
      # are calculated by the YaST proposal) or from objects of class ProposalSpaceAction
      # (if the concrete actions are already specified at the proposal settings).
      class Base
        # Identifier of the target device
        # @return [Integer]
        attr_reader :sid

        # @param device [Integer, Y2Storage::Device] sid or device
        def initialize(device)
          @sid = device.respond_to?(:sid) ? device.sid : device.to_i
        end
      end
    end
  end
end
