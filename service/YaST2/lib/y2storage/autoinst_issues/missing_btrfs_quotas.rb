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

module Y2Storage
  module AutoinstIssues
    # Represents an scenario where Btrfs quotas were not enabled for the filesystem
    # but they are needed for a subvolume.
    #
    # @example
    #   section = AutoinstProfile::PartitionSection.new_from_hashes({})
    #   problem = MissingBtrfsQuotas.new(section)
    class MissingBtrfsQuotas < ::Installation::AutoinstIssues::Issue
      # @param section [#parent,#section_name] Section where it was detected
      #                (see {AutoinstProfile})
      # @param subvolumes [Array<SubvolSpecification>]
      def initialize(section, subvolumes)
        super()

        textdomain "storage"
        @section = section
        @subvolumes = subvolumes
      end

      # Return problem severity
      #
      # @return [Symbol] :warn
      # @see Issue#severity
      def severity
        :warn
      end

      # Return the error message to be displayed
      #
      # @return [String] Error message
      # @see Issue#message
      def message
        format(
          _("Btrfs quotas will be automatically enabled because they are needed for the " \
            "following subvolumes:\n%{subvol_names}."),
          subvol_names: @subvolumes.map(&:path).join(", ")
        )
      end
    end
  end
end
