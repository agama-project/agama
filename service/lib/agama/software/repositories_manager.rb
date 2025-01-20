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

require "agama/software/repository"

module Agama
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

      # Adds a new repository
      #
      # @param url [String] Repository URL
      def add(url)
        repositories << Repository.create(name: url, url: url)
      end

      # Determines if there are registered repositories
      #
      # @return [Boolean] true if there are not repositories; false otherwise
      def empty?
        repositories.empty?
      end

      # Returns the enabled repositories
      #
      # @return [Array<Repository>]
      def enabled
        repositories.select(&:enabled?)
      end

      # Returns the disabled repositories
      #
      # @return [Array<Repository>]
      def disabled
        repositories.reject(&:enabled?)
      end

      # Loads the repository metadata
      #
      # As a side effect, it disables those repositories that cannot be read.
      # The intent is to prevent the proposal from trying to read them
      # again.
      def load
        repositories.each do |repo|
          if repo.probe
            repo.enable!
            repo.refresh
          else
            repo.disable!
          end
        end
        Yast::Pkg.SourceLoad
      end

      # Deletes all the repositories
      def delete_all
        repositories.each(&:delete!)
        repositories.clear
      end
    end
  end
end
