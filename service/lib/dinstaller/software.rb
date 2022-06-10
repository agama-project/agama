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
require "dinstaller/package_callbacks"
require "dinstaller/config"
require "y2packager/product"

Yast.import "PackageInstallation"
Yast.import "Pkg"
Yast.import "Stage"

# YaST specific code lives under this namespace
module DInstaller
  # This class is responsible for software handling
  class Software
    GPG_KEYS_GLOB = "/usr/lib/rpm/gnupg/keys/gpg-*"
    private_constant :GPG_KEYS_GLOB

    # TODO: move to yaml config
    SUPPORTED_PRODUCTS = ["Leap", "openSUSE"].freeze
    private_constant :SUPPORTED_PRODUCTS

    attr_reader :product, :products

    def initialize(logger, config)
      @logger = logger
      @products = []
      @product = "" # do not use nil here, otherwise dbus crash
      @config = config
    end

    def select_product(name)
      raise ArgumentError unless @products.any? { |p| p.name == name }

      @product = name
    end

    def probe(progress)
      logger.info "Probing software"
      store_original_repos
      Yast::Pkg.SetSolverFlags(
        "ignoreAlreadyRecommended" => false, "onlyRequires" => true
      )

      # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
      Yast::Stage.Set("normal")
      progress.init_minor_steps(3, "Initialiaze target repositories")
      Yast::Pkg.TargetInitialize("/")
      import_gpg_keys

      progress.next_minor_step("Initialize sources")
      add_base_repo

      progress.next_minor_step("Searching for supported products")
      @products = find_products
      @product = @products.first&.name || ""
      raise "No product available" if @product.empty?

      progress.next_minor_step("Making initial proposal")
      proposal = Yast::Packages.Proposal(force_reset = true, reinit = false, _simple = true)
      logger.info "proposal #{proposal["raw_proposal"]}"
      progress.next_minor_step("Software probing finished")
      Yast::Stage.Set("initial")
    end

    def propose
      Yast::Pkg.TargetFinish # ensure that previous target is closed
      Yast::Pkg.TargetInitialize(Yast::Installation.destdir)
      Yast::Pkg.TargetLoad
      selected_product = @products.find { |p| p.name == @product }
      selected_product.select
      logger.info "selected product #{selected_product.inspect}"

      add_resolvables
      proposal = Yast::Packages.Proposal(force_reset = false, reinit = false, _simple = true)
      logger.info "proposal #{proposal["raw_proposal"]}"

      solve_dependencies

      # do not return proposal hash, so intentional nil here
      nil
    end

    def install(progress)
      PackageCallbacks.setup(progress, count_packages)

      # TODO: error handling
      commit_result = Yast::PackageInstallation.Commit({})

      if commit_result.nil? || commit_result.empty?
        logger.error("Commit failed")
        raise Yast::Pkg.LastError
      end

      logger.info "Commit result #{commit_result}"
    end

    # Writes the repositories information to the installed system
    #
    # @param _progress [Progress] Progress reporting object
    def finish(_progress)
      Yast::Pkg.SourceSaveAll
      Yast::Pkg.TargetFinish
      Yast::Pkg.SourceCacheCopyTo(Yast::Installation.destdir)
      restore_original_repos
    end

  private

    # adds resolvables from yaml config for given product
    def add_resolvables
      mandatory_patterns = @config.data["software"]["mandatory_patterns"] || []
      Yast::PackagesProposal.SetResolvables("d-installer", :pattern, mandatory_patterns)

      optional_patterns = @config.data["software"]["optional_patterns"] || []
      Yast::PackagesProposal.SetResolvables("d-installer", :pattern, optional_patterns,
        optional: true)

      # FIXME: temporary workaround to get btrfsprogs into the installed system
      Yast::PackagesProposal.AddResolvables("d-installer", :package, ["btrfsprogs"])
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
        Yast::Pkg.SourceCreate(repo, "/") # TODO: having that dir also in config?
      end

      Yast::Pkg.SourceSaveAll
    end

    def find_products
      supported_products = Y2Packager::Product.available_base_products.select do |product|
        logger.info "Base product #{product.name} found."
        SUPPORTED_PRODUCTS.include?(product.name)
      end
      logger.info "Supported products found: #{supported_products.map(&:name).join(",")}"
      supported_products
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
