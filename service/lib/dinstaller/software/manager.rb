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
require "dinstaller/with_progress"
require "y2packager/product"
require "yast2/arch_filter"
require "dinstaller/software/callbacks/progress"

Yast.import "Package"
Yast.import "Packages"
Yast.import "Pkg"
Yast.import "Stage"

# YaST specific code lives under this namespace
module DInstaller
  module Software
    # This class is responsible for software handling
    class Manager
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
      end

      def select_product(name)
        return if name == @product
        raise ArgumentError unless @products[name]

        @config.pick_product(name)
        @product = name
      end

      def probe
        logger.info "Probing software"

        store_original_repos
        Yast::Pkg.SetSolverFlags("ignoreAlreadyRecommended" => false, "onlyRequires" => true)

        # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
        Yast::Stage.Set("normal")

        start_progress(3)
        progress.step("Initialize target repositories") { initialize_target_repos }
        progress.step("Initialize sources") { add_base_repo }
        progress.step("Making the initial proposal") do
          proposal = Yast::Packages.Proposal(force_reset = true, reinit = false, _simple = true)
          logger.info "proposal #{proposal["raw_proposal"]}"
        end

        Yast::Stage.Set("initial")
      end

      def initialize_target_repos
        Yast::Pkg.TargetInitialize("/")
        import_gpg_keys
      end

      def propose
        Yast::Pkg.TargetFinish # ensure that previous target is closed
        Yast::Pkg.TargetInitialize(Yast::Installation.destdir)
        Yast::Pkg.TargetLoad
        Yast::Pkg.SetAdditionalLocales(languages)
        select_base_product(@config.data["software"]["base_product"])

        add_resolvables
        proposal = Yast::Packages.Proposal(force_reset = false, reinit = false, _simple = true)
        logger.info "proposal #{proposal["raw_proposal"]}"

        solve_dependencies

        # do not return proposal hash, so intentional nil here
        nil
      end

      def install
        start_progress(count_packages)
        Callbacks::Progress.setup(count_packages, progress)

        # TODO: error handling
        commit_result = Yast::Pkg.Commit({})

        if commit_result.nil? || commit_result.empty?
          logger.error("Commit failed")
          raise Yast::Pkg.LastError
        end

        logger.info "Commit result #{commit_result}"
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
        Yast::Package.Installed(name, target: :system)
      end

    private

      # adds resolvables from yaml config for given product
      def add_resolvables
        mandatory_patterns = @config.data["software"]["mandatory_patterns"] || []
        Yast::PackagesProposal.SetResolvables("d-installer", :pattern, mandatory_patterns)

        optional_patterns = @config.data["software"]["optional_patterns"] || []
        Yast::PackagesProposal.SetResolvables("d-installer", :pattern, optional_patterns,
          optional: true)

        mandatory_packages = @config.data["software"]["mandatory_packages"] || []
        Yast::PackagesProposal.SetResolvables("d-installer", :package, mandatory_packages)

        optional_packages = @config.data["software"]["optional_packages"] || []
        Yast::PackagesProposal.SetResolvables("d-installer", :package, optional_packages,
          optional: true)
      end

      # call solver to satisfy dependency or log error
      def solve_dependencies
        res = Yast::Pkg.PkgSolve(unused = true)
        logger.info "solver run #{res.inspect}"

        return if res

        logger.error "Solver failed: #{Yast::Pkg.LastError}"
        logger.error "Details: #{Yast::Pkg.LastErrorDetails}"
        logger.error "Solving issues: #{Yast::Pkg.PkgSolveErrors}"
      end

      # @return [Logger]
      attr_reader :logger

      def count_packages
        Yast::Pkg.PkgMediaCount.reduce(0) { |sum, res| sum + res.reduce(0, :+) }
      end

      def import_gpg_keys
        gpg_keys = Dir.glob(GPG_KEYS_GLOB).map(&:to_s)
        logger.info "Importing GPG keys: #{gpg_keys}"
        gpg_keys.each do |path|
          Yast::Pkg.ImportGPGKey(path, true)
        end
      end

      def add_base_repo
        @config.data["software"]["installation_repositories"].each do |repo|
          if repo.is_a?(Hash)
            url = repo["url"]
            # skip if repo is not for current arch
            next if repo["archs"] && !Yast2::ArchFilter.from_string(repo["archs"]).match?
          else
            url = repo
          end
          Yast::Pkg.SourceCreate(url, "/") # TODO: having that dir also in config?
        end

        Yast::Pkg.SourceSaveAll
      end

      def select_base_product(name)
        base_product = Y2Packager::Product.available_base_products.find do |product|
          product.name == name
        end
        logger.info "Base product to select: #{base_product&.name}"
        base_product&.select
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
    end
  end
end
