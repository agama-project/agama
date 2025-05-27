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
        @user_repositories = []
        # remember how exactly user specify repos and return it identical
        @plain_user_repositories = {}
      end

      # Adds a new repository
      #
      # @param url [String] Repository URL
      def add(url)
        repositories << Repository.create(name: url, url: url)
      end

      # returns user repositories as it was previously specified
      def get_user_repositories
        @plain_user_repositories
      end

      # sets and loads user repositories
      def set_user_repositories(repos)
        @plain_user_repositories = repos
        clear_user_repositories
        repos.each do |repo|
          id = Yast::Pkg.RepositoryAdd(
            "name" => repo["name"],
            "base_urls" => [repo["url"].to_s],
            "alias" => repo["alias"],
            "prod_dir" => repo["product_dir"],
            "enabled" => repo["enabled"],
            "priority" => repo["priority"],
          )
          # TODO: better error reporting
          raise "failed to add repo" unless id
          zypp_repo = find(id)

          @user_repositories << zypp_repo
          repositories << zypp_repo
        end

        # load new repos
        self.load
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
            # In some rare scenarios although the repository probe succeeded the refresh might fail
            # with network timeout. In that case disable the repository to avoid implicitly
            # refreshing it again in the Pkg.SourceLoad call which could time out again, effectively
            # doubling the total timeout.
            repo.disable! unless repo.refresh
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

    private

      def clear_user_repositories
        @repositories -= @user_repositories
        @user_repositories.each(&:delete!)
        @user_repositories.clear
      end
    end
  end
end
