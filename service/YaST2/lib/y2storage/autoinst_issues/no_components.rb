# Copyright (c) [2020] SUSE LLC
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
require "installation/autoinst_issues/issue"
require "y2storage/planned/bcache"
require "y2storage/planned/btrfs"
require "y2storage/planned/lvm_vg"
require "y2storage/planned/md"

module Y2Storage
  module AutoinstIssues
    # No suitable components were found for this device
    #
    # This issue indicates that there are no suitable components for a composed device.
    # A composed device could be a LVM VG, a RAID, a Btrfs multi-device or a Bcache device.
    class NoComponents < ::Installation::AutoinstIssues::Issue
      attr_reader :planned

      # @param planned [Planned::Bcache, Planned::Btrfs, Planned::LvmVg, Planned::RAID]
      #   Planned device
      def initialize(planned)
        super()

        textdomain "storage"

        @planned = planned
      end

      # Fatal problem
      #
      # @return [Symbol] :fatal
      # @see Issue#severity
      def severity
        :fatal
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        case planned
        when Planned::Btrfs
          format(
            _("Could not find a suitable device for Btrfs filesystem '%{name}'."),
            name: planned.name
          )
        when Planned::LvmVg
          format(
            _("Could not find a suitable physical volume for volume group '%{name}'."),
            name: planned.volume_group_name
          )
        when Planned::Md
          format(
            _("Could not find a suitable member for RAID '%{name}'."),
            name: planned.name
          )
        when Planned::Bcache
          format(
            _("Could not find a backing device for Bcache '%{name}'."),
            name: planned.name
          )
        end
      end
    end
  end
end
