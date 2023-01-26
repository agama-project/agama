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

require "dinstaller/software/repository"

module DInstaller
  module Software
    # Class to manage repositories
    #
    # @see Repository
    class RepositoriesManager
      # @return [Array<Repository>]
      attr_reader :repositories

      def initialize
        @repositories = []
      end

      # @param url [String] Repository URL
      def add(url)
        repositories << Repository.create(name: url, url: url)
      end

      # Refreshes all the repositories
      def refresh_all
        repositories.each(&:refresh)
      end

      # Determines whether some repository is available
      #
      # @return [Boolean] true if at least one repository is available; false otherwise
      # @see Repository#available?
      def available?
        repositories.any?(&:available?)
      end
    end
  end
end
