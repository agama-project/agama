# frozen_string_literal: true

# Copyright (c) [2021] SUSE LLC
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
require "fileutils"
require "dinstaller/config"
require "dinstaller/helpers"
require "dinstaller/with_progress"
require "dinstaller/validation_error"
require "y2packager/product"
require "yast2/arch_filter"
require "dinstaller/software/callbacks"
require "dinstaller/software/proposal"
require "dinstaller/software/repositories_manager"

Yast.import "Package"
Yast.import "Packages"
Yast.import "PackageCallbacks"
Yast.import "Pkg"
Yast.import "Stage"

module DInstaller
  module Software
    # This class is responsible for software handling
    class Manager
      include Helpers
      include WithProgress

      GPG_KEYS_GLOB = "/usr/lib/rpm/gnupg/keys/gpg-*"
      private_constant :GPG_KEYS_GLOB

      attr_reader :product

      DEFAULT_LANGUAGES = ["en_US"].freeze
      private_constant :DEFAULT_LANGUAGES

      attr_accessor :languages

      # FIXME: what about defining a Product class?
      # @return [Array<Array<String,Hash>>] An array containing the product ID and
      #   additional information in a hash
      attr_reader :products

      attr_reader :repositories

      def initialize(config, logger)
        @config = config
        @probed = false
        @logger = logger
        @languages = DEFAULT_LANGUAGES
        @products = @config.products
        if @config.multi_product?
          @product = nil
        else
          @product = @products.keys.first # use the available product as default
          @config.pick_product(@product)
        end
        @repositories = RepositoriesManager.new
      end

      def select_product(name)
        return if name == @product
        raise ArgumentError unless @products[name]

        @config.pick_product(name)
        @product = name
        @probed = false # reset probing when product changed
      end

      def probe
        logger.info "Probing software"

        store_original_repos

        # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
        Yast::Stage.Set("normal")

        start_progress(3)
        Yast::PackageCallbacks.InitPackageCallbacks(logger)
        progress.step("Initialize target repositories") { initialize_target_repos }
        progress.step("Initialize sources") { add_base_repos }
        progress.step("Making the initial proposal") { propose }

        @probed = true
        Yast::Stage.Set("initial")
      end

      def initialize_target_repos
        Yast::Pkg.TargetInitialize("/")
        import_gpg_keys
      end

      def propose
        return unless repositories.available?

        proposal.base_product = @product
        proposal.languages = languages
        select_resolvables
        result = proposal.calculate
        logger.info "Proposal result: #{result.inspect}"
        result
      end

      def validate
        return [ValidationError.new("No repositories are available")] unless repositories.available?

        proposal.errors
      end

      def install
        steps = proposal.packages_count
        start_progress(steps)
        Callbacks::Progress.setup(steps, progress)

        # TODO: error handling
        commit_result = Yast::Pkg.Commit({})

        if commit_result.nil? || commit_result.empty?
          logger.error("Commit failed")
          raise Yast::Pkg.LastError
        end

        logger.info "Commit result #{commit_result}"
      rescue DInstaller::WithProgress::NotFinishedProgress => e
        logger.error "There is an unfinished progress: #{e.inspect}"
        finish_progress
      end

      # Writes the repositories information to the installed system
      def finish
        start_progress(2)
        progress.step("Writing repositories to the target system") do
          Yast::Pkg.SourceSaveAll
          Yast::Pkg.TargetFinish
          Yast::Pkg.SourceCacheCopyTo(Yast::Installation.destdir)
        end
        progress.step("Restoring original repositories") { restore_original_repos }
      end

      # Determine whether the given tag is provided by the selected packages
      #
      # @param tag [String] Tag to search for (package names, requires/provides, or file
      #   names)
      # @return [Boolean] true if it is provided; false otherwise
      def provision_selected?(tag)
        Yast::Pkg.IsSelected(tag) || Yast::Pkg.IsProvided(tag)
      end

      # Determines whether a package is installed
      #
      # @param name [String] Package name
      # @return [Boolean] true if it is installed; false otherwise
      def package_installed?(name)
        on_target { Yast::Package.Installed(name, target: :system) }
      end

      # Counts how much disk space installation will use.
      # @return [String]
      # @note Reimplementation of Yast::Package.CountSizeToBeInstalled
      # @todo move to Software::Proposal
      def used_disk_space
        return "" unless @probed

        # FormatSizeWithPrecision(bytes, precision, omit_zeroes)
        Yast::String.FormatSizeWithPrecision(proposal.packages_size, 1, true)
      end

    private

      def proposal
        @proposal ||= Proposal.new
      end

      # @return [Logger]
      attr_reader :logger

      def import_gpg_keys
        gpg_keys = Dir.glob(GPG_KEYS_GLOB).map(&:to_s)
        logger.info "Importing GPG keys: #{gpg_keys}"
        gpg_keys.each do |path|
          Yast::Pkg.ImportGPGKey(path, true)
        end
      end

      def installation_repositories
        @config.data["software"]["installation_repositories"]
      end

      def add_base_repos
        installation_repositories.each do |repo|
          if repo.is_a?(Hash)
            url = repo["url"]
            # skip if repo is not for current arch
            next if repo["archs"] && !Yast2::ArchFilter.from_string(repo["archs"]).match?
          else
            url = repo
          end
          # TODO: report failing repositories
          repositories.add(url)
        end
        repositories.refresh_all
      end

      REPOS_BACKUP = "/etc/zypp/repos.d.dinstaller.backup"
      private_constant :REPOS_BACKUP

      REPOS_DIR = "/etc/zypp/repos.d"
      private_constant :REPOS_DIR

      # ensure that repos backup is there and repos.d is empty
      def store_original_repos
        # Backup was already created, so just remove all repos
        if File.directory?(REPOS_BACKUP)
          logger.info "removing #{REPOS_DIR}"
          FileUtils.rm_rf(REPOS_DIR)
        else # move repos to backup
          logger.info "moving #{REPOS_DIR} to #{REPOS_BACKUP}"
          FileUtils.mv(REPOS_DIR, REPOS_BACKUP)
        end
      end

      def restore_original_repos
        logger.info "removing #{REPOS_DIR}"
        FileUtils.rm_rf(REPOS_DIR)
        logger.info "moving #{REPOS_BACKUP} to #{REPOS_DIR}"
        FileUtils.mv(REPOS_BACKUP, REPOS_DIR)
      end

      # adds resolvables from yaml config for given product
      def select_resolvables
        mandatory_patterns = @config.data["software"]["mandatory_patterns"] || []
        proposal.set_resolvables("d-installer", :pattern, mandatory_patterns)

        optional_patterns = @config.data["software"]["optional_patterns"] || []
        proposal.set_resolvables("d-installer", :pattern, optional_patterns,
          optional: true)

        mandatory_packages = @config.data["software"]["mandatory_packages"] || []
        proposal.set_resolvables("d-installer", :package, mandatory_packages)

        optional_packages = @config.data["software"]["optional_packages"] || []
        proposal.set_resolvables("d-installer", :package, optional_packages,
          optional: true)
      end
    end
  end
end
