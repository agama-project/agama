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
require "singleton"

module Agama
  module Software
    # Class to manage repositories
    #
    # @see Repository
    class RepositoriesManager
      include Singleton

      # @return [Array<Repository>]
      attr_reader :repositories

      def reset
        @repositories = []
        @user_repositories = []
        # remember how exactly user specify repos and return it identical
        @plain_user_repositories = []
        @unsigned_repos = []
        @gpg_fingerprints = {}
      end

      # Adds a new repository
      #
      # @param url [String] Repository URL
      # @param name [String] Repository name, if not specified the URL is used
      # @param repo_alias [String] Repository alias, must be unique,
      #   if not specified a random one is generated
      # @param autorefresh [Boolean] Whether the repository should be autorefreshed
      # @param priority    [Integer] Repository priority, the lower number the higher (!)
      #                              priority, the default libzypp priority is 99
      def add(url, name: nil, repo_alias: "", autorefresh: true, priority: 99)
        repositories << Repository.create(name: name || url, url: url, repo_alias: repo_alias,
          autorefresh: autorefresh, priority: priority)
      end

      # returns user repositories as it was previously specified
      def user_repositories
        @plain_user_repositories
      end

      # sets and loads user repositories
      def user_repositories=(repos)
        @plain_user_repositories = repos
        clear_user_repositories
        repos.each do |repo|
          id = Yast::Pkg.RepositoryAdd(
            "name"      => repo["name"],
            "base_urls" => [repo["url"].to_s],
            "alias"     => repo["alias"],
            "prod_dir"  => repo["product_dir"],
            "enabled"   => repo["enabled"],
            "priority"  => repo["priority"]
          )
          # TODO: better error reporting
          raise "failed to add repo" unless id

          zypp_repo = Repository.find(id)

          @user_repositories << zypp_repo
          repositories << zypp_repo

          @unsigned_repos << repo["alias"] if repo["allow_unsigned"]
          @gpg_fingerprints[repo["alias"]] = repo["gpg_fingerprints"]
            &.map { |f| f.gsub(/\s/, "") } || []
        end

        # load new repos
        self.load
      end

      def unsigned_allowed?(repo_alias)
        @unsigned_repos.include?(repo_alias)
      end

      def trust_gpg?(repo_alias, fingerprint)
        @gpg_fingerprints[repo_alias]&.include?(fingerprint.gsub(/\s/, ""))
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

        @unsigned_repos = []
        @gpg_fingerprints = {}
      end

      def initialize
        reset
      end
    end
  end
end
