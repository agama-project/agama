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
require "yast2/package_callbacks"
require "y2packager/product"

Yast.import "Pkg"
Yast.import "PackageInstallation"
Yast.import "Stage"

# YaST specific code lives under this namespace
module Yast2
  # This class is responsible for software handling
  class Software
    attr_reader :product, :products

    def initialize(logger)
      @logger = logger
      @products = []
      @product = nil
    end

    def select_product(name)
      raise ArgumentError unless @products.any? { |p| p.name == name }

      @product = name
    end

    def probe
      logger.info "Probing software"
      # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
      Yast::Stage.Set("normal")
      Yast::Pkg.TargetInitialize("/")
      Yast::Pkg.TargetLoad
      Yast::Pkg.SourceRestore
      Yast::Pkg.SourceLoad
      @products = Y2Packager::Product.all
      @product = @products.first&.name
      proposal = Yast::Packages.Proposal(force_reset = true, reinit = false, _simple = true)
      @logger.info "proposal #{proposal["raw_proposal"]}"
      Yast::Stage.Set("initial")

      raise "No Product Available" unless @product
    end

    def propose
      selected_product = @products.find { |p| p.name == @product }
      selected_product.select
      @logger.info "selected product #{selected_product.inspect}"

      # as we use liveDVD with normal like ENV, lets temporary switch to normal to use its repos
      Yast::Stage.Set("normal")
      proposal = Yast::Packages.Proposal(force_reset = false, reinit = false, _simple = true)
      @logger.info "proposal #{proposal["raw_proposal"]}"
      res = Yast::Pkg.PkgSolve(unused = true)
      @logger.info "solver run #{res.inspect}"

      Yast::Stage.Set("initial")
      # do not return proposal hash, so intentional nil here
      nil
    end

    def install(progress)
      count_packages(progress)

      PackageCallbacks.setup(progress)

      # TODO: error handling
      Yast::Pkg.TargetInitialize(Yast::Installation.destdir)
      commit_result = Yast::PackageInstallation.Commit({})

      if commit_result.nil? || commit_result.empty?
        log.error("Commit failed")
        raise Yast::Pkg.LastError
      end
    end

  private

    attr_reader :logger

    def count_packages(progress)
      count = Yast::Pkg.PkgMediaCount.reduce(0) { |sum, res| sum + res.reduce(0, :+) }

      progress.packages_to_install = count
    end
  end
end
