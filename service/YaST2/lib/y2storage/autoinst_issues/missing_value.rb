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

require "installation/autoinst_issues/issue"

module Y2Storage
  module AutoinstIssues
    # Represents an AutoYaST situation where a mandatory value is missing.
    #
    # @example Missing value for attribute 'size' in '/dev/sda' device.
    #   section = AutoinstProfile::PartitionSection.new_from_hashes({})
    #   problem = MissingValue.new(section, :size)
    #   problem.attr #=> :size
    class MissingValue < ::Installation::AutoinstIssues::Issue
      # @return [Symbol] Name of the missing attribute
      attr_reader :attr

      # @param section [#parent,#section_name] Section where it was detected
      #                (see {AutoinstProfile})
      # @param attr    [Symbol] Name of the missing attribute
      def initialize(section, attr)
        super()

        textdomain "storage"

        @section = section
        @attr = attr
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
        # TRANSLATORS: AutoYaST element
        format(_("Missing element '%{attr}'"), attr: attr)
      end
    end
  end
end
