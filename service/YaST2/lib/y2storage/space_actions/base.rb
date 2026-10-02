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

require "y2storage/equal_by_instance_variables"

module Y2Storage
  module SpaceActions
    # Base class for representing the actions of the bigger_resize SpaceMaker strategy
    class Base
      include EqualByInstanceVariables
      attr_reader :device

      # Constructor
      def initialize(device)
        @device = device
      end

      # Checks whether this is a concrete kind(s) of action
      # @return [Boolean]
      def is?(*types)
        (types.map(&:to_sym) & types_for_is).any?
      end

      # @see #is?
      def types_for_is
        []
      end
    end
  end
end
