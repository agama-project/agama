# Copyright (c) [2018] SUSE LLC
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

module Y2Storage
  module AutoinstIssues
    # Represents an AutoYaST situation where a thin pool was not found.
    #
    # This is a fatal error.
    class ThinPoolNotFound < ::Installation::AutoinstIssues::Issue
      # @param section [#parent,#section_name] Section where it was detected
      #                (see {AutoinstProfile})
      def initialize(section)
        super()

        textdomain "storage"

        @section = section
      end

      # Return problem severity
      #
      # @return [Symbol] :fatal
      def severity
        :fatal
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        # TRANSLATORS: LVM thin pool name (eg. 'pool0')
        _("Thin pool '%s' was not found") % section.used_pool
      end
    end
  end
end
