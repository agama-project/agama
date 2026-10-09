# Copyright (c) [2024] SUSE LLC
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

require "y2storage/space_actions/base"

module Y2Storage
  module SpaceActions
    # Delete action to configure the bigger_resize SpaceMaker strategy
    class Delete < Base
      # Whether the delete action must always be executed (if the involved disk is processed)
      # @return [Boolean]
      attr_reader :mandatory

      # Constructor
      def initialize(device, mandatory: false)
        super(device)
        @mandatory = mandatory
      end

      # @see #is?
      def types_for_is
        [:delete]
      end
    end
  end
end
