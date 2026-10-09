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
    # Resize action to configure the bigger_resize SpaceMaker strategy
    class Resize < Base
      # Min size the device should have.
      #
      # Nil is equivalent to the initial size of the device (no shrinking, only growing).
      #
      # @return [DiskSize, nil]
      attr_reader :min_size

      # Max size the device should have.
      #
      # Nil is equivalent to the initial size of the device (no growing, only shrinking).
      #
      # @return [DiskSize, nil]
      attr_reader :max_size

      # Constructor
      def initialize(device, min_size: DiskSize.zero, max_size: nil)
        super(device)
        @min_size = min_size
        @max_size = max_size
      end

      # @see #is?
      def types_for_is
        [:resize]
      end
    end
  end
end
