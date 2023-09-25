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
require "agama/config"
require "agama/helpers"
require "agama/with_progress"
require "agama/validation_error"
require "y2packager/product"
require "y2packager/resolvable"
require "yast2/arch_filter"
require "agama/software/callbacks"
require "agama/software/proposal"
require "agama/software/repositories_manager"

Yast.import "Package"
Yast.import "Packages"
Yast.import "PackageCallbacks"
Yast.import "Pkg"
Yast.import "Stage"

module Agama
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
        on_progress_change { logger.info progress.to_s }
        # patterns selected by user
        @user_patterns = []
        @selected_patterns_change_callbacks = []
      end

      def select_product(name)
        return if name == @product
        raise ArgumentError unless @products[name]

        @config.pick_product(name)
        @product = name
        repositories.delete_all
      end

      def probe
        logger.info "Probing software"

        # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
        Yast::Stage.Set("normal")

        if repositories.empty?
          start_progress(4)
          store_original_repos
          Yast::PackageCallbacks.InitPackageCallbacks(logger)
          progress.step("Initializing target repositories") { initialize_target_repos }
          progress.step("Initializing sources") { add_base_repos }
        else
          start_progress(2)
        end

        progress.step("Refreshing repositories metadata") { repositories.load }
        progress.step("Calculating the software proposal") { propose }

        Yast::Stage.Set("initial")
      end

      def initialize_target_repos
        Yast::Pkg.TargetInitialize("/")
        import_gpg_keys
      end

      # Updates the software proposal
      def propose
        proposal.base_product = selected_base_product
        proposal.languages = languages
        select_resolvables
        result = proposal.calculate
        logger.info "Proposal result: #{result.inspect}"
        result
      end

      # Returns the errors related to the software proposal
      #
      # * Repositories that could not be probed are reported as errors.
      # * If none of the repositories could be probed, do not report missing
      #   patterns and/or packages. Those issues does not make any sense if there
      #   are no repositories to install from.
      def validate
        errors = repositories.disabled.map do |repo|
          ValidationError.new("Could not read the repository #{repo.name}")
        end
        return errors if repositories.enabled.empty?

        errors + proposal.errors
      end

      # Installs the packages to the target system
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
      rescue Agama::WithProgress::NotFinishedProgress => e
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

      # Enlist available patterns
      #
      # @param filtered [Boolean] If list of patterns should be filtered.
      #                           Filtering criteria can change.
      # @return [Array<Y2Packager::Resolvable>]
      def patterns(filtered)
        patterns = Y2Packager::Resolvable.find(kind: :pattern)
        patterns = patterns.select(&:user_visible) if filtered

        patterns
      end

      def add_pattern(id)
        # TODO: error handling
        res = Yast::Pkg.ResolvableInstall(id, :pattern)
        logger.info "Adding pattern #{res.inspect}"
        @user_patterns << id

        res = Yast::Pkg.PkgSolve(unused = true)
        logger.info "Solver run #{res.inspect}"
        selected_patterns_changed
      end

      def remove_pattern(id)
        # TODO: error handling
        Yast::Pkg.ResolvableRemove(id, :pattern)
        logger.info "Removing pattern #{res.inspect}"
        @user_patterns << id

        res = Yast::Pkg.PkgSolve(unused = true)
        logger.info "Solver run #{res.inspect}"
        selected_patterns_changed
      end

      def user_patterns=(ids)
        @user_patterns.each { |p| Yast::Pkg.ResolvableRemove(p, :pattern) }
        @user_patterns = ids
        @user_patterns.each { |p| Yast::Pkg.ResolvableInstall(p, :pattern) }
        logger.info "Setting patterns to #{res.inspect}"

        res = Yast::Pkg.PkgSolve(unused = true)
        logger.info "Solver run #{res.inspect}"
        selected_patterns_changed
      end

      # @return [Array<Array<String>,Array<String>] returns pair of arrays where the first one
      #   is user selected pattern ids and in other is auto selected ones
      def selected_patterns
        patterns = Y2Packager::Resolvable.find(kind: :pattern, status: :selected)
        patterns.map!(&:name)

        patterns.partition { |p| @user_patterns.include?(p) }
      end

      def on_selected_patterns_change(&block)
        @selected_patterns_change_callbacks << block
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
        return "" unless proposal.valid?

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

      def arch_select(section)
        collection = @config.data["software"][section] || []
        collection.select { |c| !c.is_a?(Hash) || arch_match?(c["archs"]) }
      end

      def arch_collection_for(section, key)
        arch_select(section).map { |r| r.is_a?(Hash) ? r[key] : r }
      end

      def selected_base_product
        @config.data["software"]["base_product"]
      end

      def arch_match?(archs)
        return true if archs.nil?

        Yast2::ArchFilter.from_string(archs).match?
      end

      def add_base_repos
        arch_collection_for("installation_repositories", "url").map { |url| repositories.add(url) }
      end

      REPOS_BACKUP = "/etc/zypp/repos.d.agama.backup"
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
        mandatory_patterns = arch_collection_for("mandatory_patterns", "pattern")
        proposal.set_resolvables("agama", :pattern, mandatory_patterns)

        optional_patterns = arch_collection_for("optional_patterns", "pattern")
        proposal.set_resolvables("agama", :pattern, optional_patterns,
          optional: true)

        mandatory_packages = arch_collection_for("mandatory_packages", "package")
        proposal.set_resolvables("agama", :package, mandatory_packages)

        optional_packages = arch_collection_for("optional_packages", "package")
        proposal.set_resolvables("agama", :package, optional_packages,
          optional: true)
      end

      def selected_patterns_changed
        @selected_patterns_change_callbacks.each(&:call)
      end
    end
  end
end
