# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "y2packager/repository"

module DInstaller
  module Software
    # This class represents a software repository
    #
    # It extends the `Y2Packager::Repository` with some useful methods in the context of
    # D-Installer (e.g., #refresh and #available?)
    #
    # @see RepositoriesManager
    class Repository < Y2Packager::Repository
      # Refreshes the repository metadata
      def refresh
        @available = Yast::Pkg.SourceRefreshNow(repo_id)
      end

      # Determines whether a repository is available or not
      #
      # A repository is available when it is possible to read its metadata.
      def available?
        !!@available
      end
    end
  end
end
