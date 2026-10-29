# Copyright (c) [2022] SUSE LLC
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
  module Callbacks
    # Class to implement callbacks used during probing
    #
    # This classes can be inherited to customize the behavior during
    # the probing phase.
    class UserProbe
      include Yast::Logger

      # Reports activation and probing issues
      #
      # This default implementation always returns true, asking libstorage-ng
      # to continue.
      #
      # @param issues [IssuesList] Probing issues
      # @return [Boolean] true if the user acknowledges the issues and wants
      #   to continue; false otherwise.
      def report_issues(issues)
        log.info "Found the following issues in the devicegraph: #{issues.inspect}"
        true
      end

      # Determines whether to install packages which provide missing commands
      #
      # This default implementation always returns false, preventing packages
      # installation.
      #
      # @param packages [Array<String>] List of packages to install
      # @return [Boolean] return true if the package should be installed; false otherwise
      def install_packages?(packages)
        log.info "Found the following issues in the devicegraph: #{packages}"
        false
      end
    end
  end
end
