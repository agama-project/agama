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
  # Issue when Bcache is not supported and there are Bcache devices
  class UnsupportedBcacheIssue < Issue
    include Yast::I18n

    def initialize
      textdomain "storage"

      super(build_message, description: build_description)
    end

    # Builds message of the issue
    #
    # @return [String]
    def build_message
      _("Bcache detected, but bcache is not supported on this platform.")
    end

    # Builds description of the issue
    #
    # @return [String]
    def build_description
      _("This may or may not work. Use at your own risk. The safe way is to remove this bcache " \
        "manually with command line tools and then restart YaST.")
    end
  end
end
