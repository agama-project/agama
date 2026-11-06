# Copyright (c) [2017] SUSE LLC
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
    # This class holds information about size devices for AutoYaST
    class AutoinstSize
      # @return [String] User provided value ("10GB", "auto", "max", etc.)
      attr_reader :value
      # @return [DiskSize,nil] Minimal size
      attr_reader :min
      # @return [DiskSize,nil] Maximal size
      attr_reader :max
      # @return [Integer,nil] Weight
      attr_reader :weight
      # @return [Float] Device's percentage
      attr_reader :percentage

      # Constructor
      def initialize(value, min: nil, max: nil, weight: nil, percentage: nil)
        @value = value
        @min = min
        @max = max
        @weight = weight
        @percentage = percentage
      end

      # Determines whether the size is unlimited
      #
      # @return [Boolean] +true+ if unlimited; +false+ otherwise.
      def unlimited?
        !!max && max.unlimited?
      end
    end
  end
end
