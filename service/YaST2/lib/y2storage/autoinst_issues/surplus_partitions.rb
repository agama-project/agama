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
    # Represents an AutoYaST situation where drive was expected to contain only
    # one partition subsection (e.g. disklabel is 'none') but it contained
    # several (all but the first will be ignored).
    class SurplusPartitions < ::Installation::AutoinstIssues::Issue
      # @param section [#parent,#section_name] Section where it was detected
      #                (see {AutoinstProfile})
      def initialize(section)
        super()

        textdomain "storage"

        @section = section
      end

      # Problem severity
      #
      # @return [Symbol] :warn
      def severity
        :warn
      end

      # Error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        _("The drive contains several partition sections, but only the first will be considered.")
      end
    end
  end
end
