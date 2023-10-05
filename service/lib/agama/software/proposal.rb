# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
require "agama/issue"

Yast.import "Stage"
Yast.import "Installation"
Yast.import "Pkg"
Yast.import "PackagesProposal"
Yast.import "Packages"

module Agama
  module Software
    # Backend class to calculate the software proposal
    #
    # This class represents a software proposal. Beware that it is a wrapper around `Yast::Pkg` and
    # `Yast::PackagesProposal` and most of the state is kept in those modules. For that reason, a
    # new instance of this class might has already some implicit state (e.g., the list of
    # repositories to use, the list of packages/patterns to install, etc.).
    #
    # @todo implement a reset mechanism to clear repositories, seleced packages/patterns, etc.
    # @note you might expect that it receives a RepositoriesManager instance. However, as the state
    #   is kept in the `Yast::Pkg` module, it is not needed at all.
    #
    # @example Calculate a proposal
    #   proposal = Proposal.new
    #   proposal.base_product = "openSUSE"
    #   proposal.add_resolvables("agama", :pattern, ["enhanced_base"])
    #   proposal.languages = ["en_US", "de_DE"]
    #   proposal.calculate #=> true
    #   proposal.issues #=> []
    class Proposal
      # @return [String,nil] Base product
      attr_accessor :base_product

      # @return [Array<String>] List of languages to install
      attr_accessor :languages

      # @return [Array<Agama::Issue>] List of issues from the calculated proposal
      attr_reader :issues

      # Constructor
      #
      # @param logger [Logger]
      def initialize(logger: nil)
        @logger = logger || Logger.new($stdout)
        @issues = []
        @base_product = nil
        @calculated = false
      end

      # Adds the given list of resolvables to the proposal
      #
      # It relies on the Yast::PackagesProposal module which keeps its own state.
      #
      # @param unique_id [String] Unique identifier for the resolvables list
      # @param type [Symbol] Resolvables type (:package or :pattern)
      # @param resolvables [Array<String>] Resolvables to add
      # @param optional [Boolean] Whether the resolvable is optional (or mandatory)
      def set_resolvables(unique_id, type, resolvables, optional: false)
        Yast::PackagesProposal.SetResolvables(unique_id, type, resolvables, optional: optional)
      end

      # Calculates the proposal
      #
      # @return [Boolean]
      def calculate
        @issues.clear
        initialize_target
        select_base_product
        proposal = Yast::Packages.Proposal(force_reset = true, reinit = false, _simple = true)
        solve_dependencies

        @calculated = true
        @issues = find_issues(proposal)
        valid?
      end

      # Returns the count of packages to install
      #
      # @return [Integer] count of packages to install
      def packages_count
        Yast::Pkg.PkgMediaCount.reduce(0) { |sum, res| sum + res.reduce(0, :+) }
      end

      # Returns the size of the packages to install
      #
      # @return [Integer] size of the installation in bytes
      def packages_size
        Yast::Pkg.PkgMediaSizes.reduce(0) do |res, media_size|
          media_size.reduce(res, :+)
        end
      end

      # Determines whether the proposal is valid
      #
      # @return [Boolean]
      def valid?
        @calculated && @issues.empty?
      end

    private

      # @return [Logger]
      attr_reader :logger

      # Initializes the target, closing the previous one
      def initialize_target
        Yast::Pkg.TargetFinish # ensure that previous target is closed
        Yast::Pkg.TargetInitialize(Yast::Installation.destdir)
        Yast::Pkg.TargetLoad
        Yast::Pkg.SetAdditionalLocales(languages)
        Yast::Pkg.SetSolverFlags("ignoreAlreadyRecommended" => false, "onlyRequires" => true)
      end

      # Selects the base product
      #
      # @see #base_product
      def select_base_product
        base_product = Y2Packager::Product.available_base_products.find do |product|
          product.name == @base_product
        end

        if base_product.nil?
          logger.error "Could not select the base product '#{@base_product}'"
        else
          logger.info "Selecting the base product '#{base_product.name}'"
          base_product&.select
        end
      end

      # Returns the issues from the attempt to create a proposal.
      #
      # It collects issues from:
      #
      # * The proposal result.
      # * The last solver execution.
      #
      # @param proposal_result [Hash] Proposal result; it might contain a "warning" key with warning
      #   messages.
      # @return [Array<Agama::Issue>] List of issues.
      def find_issues(proposal_result)
        msgs = []
        msgs.concat(warning_messages(proposal_result))
        msgs.concat(solver_messages)
        msgs.map do |msg|
          Issue.new(msg,
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::WARN)
        end
      end

      # Runs the solver to satisfy the solve_dependencies
      #
      # If the solver failed, it logs the error.
      #
      # @return [Boolean] whether the solver ran successfully
      def solve_dependencies
        res = Yast::Pkg.PkgSolve(unused = true)
        logger.info "Solver run #{res.inspect}"
        return true if res

        logger.error "Solver failed: #{Yast::Pkg.LastError}"
        logger.error "Details: #{Yast::Pkg.LastErrorDetails}"
        logger.error "Solver errors: #{Yast::Pkg.PkgSolveErrors}"
        false
      end

      # Extracts the warning messages from the proposal result
      #
      # @param proposal_result [Hash] Proposal result; it might contain a "warning" key with warning
      #   messages.
      def warning_messages(proposal_result)
        return [] unless proposal_result["warning_level"] == :blocker

        proposal_result["warning"]
          .split("<br>")
          .grep_v(/Please manually select .*/) # FIXME: it depends on the language
      end

      # Returns solver error messages from the last attempt
      #
      # @return [Array<String>] Error messages
      def solver_messages
        solve_errors = Yast::Pkg.PkgSolveErrors
        return [] if solve_errors.zero?

        last_error = Yast::Pkg.LastError
        res = []
        res << last_error unless last_error.empty?
        res << "Found #{solve_errors} dependency issues." if solve_errors > 0
        res
      end
    end
  end
end
