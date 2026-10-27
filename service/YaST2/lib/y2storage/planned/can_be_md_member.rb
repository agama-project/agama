# Copyright (c) [2018-2019] SUSE LLC
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
  module Planned
    # Mixin for planned devices that can act as MD RAID member
    # @see Planned::Device
    module CanBeMdMember
      # @return [String] name of the MD array to which this partition should
      #   be added
      attr_accessor :raid_name

      # Initializations of the mixin, to be called from the class constructor.
      def initialize_can_be_md_member; end

      # Checks whether the device represents an MD RAID member
      def md_member?
        !raid_name.nil?
      end

      # @see Planned::Device#component?
      #
      # @return [Boolean]
      def component?
        super || md_member?
      end
    end
  end
end
