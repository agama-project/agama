# Copyright (c) [2021] SUSE LLC
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
require "yast/i18n"
require "y2storage/issue"

Yast.import "Mode"

module Y2Storage
  # Issue for a LVM VG with missing PVs
  class MissingLvmPvIssue < Issue
    include Yast::I18n

    # Constructor
    #
    # @param device [LvmVg]
    def initialize(device)
      textdomain "storage"

      super(build_message(device), description: build_description, device: device)
    end

    # Builds the message of the issue
    #
    # @param device [LvmVg]
    # @return [String]
    def build_message(device)
      format(
        # TRANSLATORS: %{name} is the name of an LVM Volume Group (e.g., /dev/vg1)
        _("The volume group %{name} is incomplete because some physical volumes are missing."),
        name: device.name
      )
    end

    # Builds the description of the issue
    #
    # @return [String]
    def build_description
      if Yast::Mode.installation
        _("If you continue, the volume group will be deleted later as part of the installation " \
          "process. Moreover, incomplete volume groups are ignored by the partitioning proposal " \
          "and are not visible in the Expert Partitioner.")
      else
        _("Incomplete volume groups are not visible in the Partitioner and will be deleted at the " \
          "final step, when all the changes are performed in the system.")
      end
    end
  end
end
