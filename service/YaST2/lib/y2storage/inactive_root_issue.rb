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

module Y2Storage
  # Issue when the root filesystem is not currently mounted
  class InactiveRootIssue < Issue
    include Yast::I18n

    # Constructor
    #
    # @param filesystem [Filesystems::Base]
    def initialize(filesystem)
      textdomain "storage"

      super(build_message, description: build_description(filesystem), device: filesystem)
    end

    # Builds the message
    #
    # @return [String]
    def build_message
      _("The root filesystem looks like not currently mounted.")
    end

    # Builds the description
    #
    # @param filesystem [Filesystems::Base]
    # @return [String, nil]
    def build_description(filesystem)
      return nil unless filesystem.is?(:btrfs)

      _("If you have executed a snapshot rollback, please reboot your system before continuing.")
    end
  end
end
