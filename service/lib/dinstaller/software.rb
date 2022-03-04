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

require "singleton"
require "yast"
require "dinstaller/package_callbacks"
require "y2packager/product"

Yast.import "Pkg"
Yast.import "PackageInstallation"
Yast.import "Stage"

# YaST specific code lives under this namespace
module DInstaller
  # This class is responsible for software handling
  class Software
    include Singleton

    attr_reader :product, :products
    attr_accessor :logger

    def initialize
      @logger = Logger.new($stdout)
      @products = []
      @product = nil
    end

    def select_product(name)
      raise ArgumentError unless @products.any? { |p| p.name == name }

      @product = name
    end

    def probe(progress)
      logger.info "Probing software"
      # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
      Yast::Stage.Set("normal")
      progress.init_minor_steps(3, "Initialiaze target repositories")
      Yast::Pkg.TargetInitialize("/")
      Yast::Pkg.TargetLoad
      progress.next_minor_step("Initialize sources")
      Yast::Pkg.SourceRestore
      Yast::Pkg.SourceLoad
      progress.next_minor_step("Making initial proposal")
      @products = Y2Packager::Product.available_base_products
      @product = @products.first&.name
      proposal = Yast::Packages.Proposal(force_reset = true, reinit = false, _simple = true)
      logger.info "proposal #{proposal["raw_proposal"]}"
      progress.next_minor_step("Software probing finished")
      Yast::Stage.Set("initial")

      raise "No Product Available" unless @product
    end

    def propose
      Yast::Pkg.TargetInitialize(Yast::Installation.destdir)
      Yast::Pkg.TargetLoad
      selected_product = @products.find { |p| p.name == @product }
      selected_product.select
      logger.info "selected product #{selected_product.inspect}"

      # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
      Yast::Stage.Set("normal")
      # FIXME: workaround to have at least reasonable proposal
      Yast::PackagesProposal.AddResolvables("the-installer", :pattern, ["base", "enhanced_base"])
      proposal = Yast::Packages.Proposal(force_reset = false, reinit = false, _simple = true)
      logger.info "proposal #{proposal["raw_proposal"]}"
      res = Yast::Pkg.PkgSolve(unused = true)
      logger.info "solver run #{res.inspect}"

      Yast::Stage.Set("initial")
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

  private

    def count_packages
      Yast::Pkg.PkgMediaCount.reduce(0) { |sum, res| sum + res.reduce(0, :+) }
    end
  end
end
