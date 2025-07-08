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
require "agama/with_issues"

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
      include WithIssues
      include Yast::I18n

      # @return [String,nil] Base product
      attr_accessor :base_product

      # @return [Array<String>] Addon products
      attr_accessor :addon_products

      # @return [Array<String>] List of languages to install
      attr_reader :languages

      # @return [Array<Hash<string, Object>>>] List of conflicts from the last solver run
      attr_reader :conflicts

      # @return [boolean, nil] flag to indicate that solver should add only required packages
      #   and not recommended. Nil means not set
      attr_accessor :only_required

      # Constructor
      #
      # @param logger [Logger]
      def initialize(logger: nil)
        textdomain "agama"

        @logger = logger || Logger.new($stdout)
        @base_product = nil
        @addon_products = []
        @conflicts = []
        @conflicts_change_callbacks = []
        @only_required = nil
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
        initialize_target
        @proposal = Yast::Packages.Proposal(force_reset = true, reinit = false, _simple = true)
        # select the base product after running the Packages.Proposal, the force_reset = true
        # option would reset the selection and a random product would be selected by the solver
        select_base_product
        select_addon_products
        solve_dependencies

        valid?
      end

      # Runs the solver to satisfy the dependencies.
      #
      # Issues are updated once the solver finishes.
      #
      # @return [Boolean] whether the solver ran successfully
      def solve_dependencies
        res = Yast::Pkg.PkgSolve(unused = true)
        logger.info "Solver run #{res.inspect}"
        update_issues
        update_conflicts

        return true if res

        logger.error "Solver failed: #{Yast::Pkg.LastError}"
        logger.error "Details: #{Yast::Pkg.LastErrorDetails}"
        logger.error "Solver errors: #{Yast::Pkg.PkgSolveErrors}"
        false
      end

      # @param [Array<(Integer, Integer)>] solutions is array of conflict id and solution id
      def solve_conflicts(solutions)
        pkg_solutions = solutions.map do |sol|
          con_id, sol_id = sol
          conflict = @conflicts[con_id] or raise "Unknown conflict id #{con_id.inspect}"
          solution = conflict["solutions"][sol_id] or raise "unknown solution id #{sol_id.inspect}"
          {
            "description"          => conflict["description"],
            "details"              => conflict["details"],
            "solution_description" => solution["description"],
            "solution_details"     => solution["details"]
          }
        end
        logger.info "Sending solver solutions #{pkg_solutions.inspect}"

        Yast::Pkg.PkgSetSolveSolutions(pkg_solutions)

        # and rerun solver to also update conflicts
        solve_dependencies
      end

      def on_conflicts_change(&block)
        @conflicts_change_callbacks << block
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
        !(proposal.nil? || errors?)
      end

      # Sets the languages to install
      #
      # @param [Array<String>] value Languages in xx_XX format (e.g., "en_US").
      def languages=(value)
        @languages = value.map { |l| l.split(".").first }.compact
      end

    private

      # @return [Logger]
      attr_reader :logger

      # Proposal result
      #
      # @return [Hash, nil] nil if not calculated yet.
      attr_reader :proposal

      # Initializes the target, closing the previous one
      def initialize_target
        preferred, *additional = languages
        Yast::Pkg.SetPackageLocale(preferred || "")
        Yast::Pkg.SetAdditionalLocales(additional)

        Yast::Pkg.SetSolverFlags("ignoreAlreadyRecommended" => false,
          "onlyRequires" => !!@only_required)
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

      # select the addon products to install
      def select_addon_products
        addon_products.each { |a| Yast::Pkg.ResolvableInstall(a, :product) }
      end

      # Updates the issues from the attempt to create a proposal.
      #
      # It collects issues from:
      #
      # * The proposal result.
      # * The last solver execution.
      #
      # @return [Array<Agama::Issue>]
      def update_issues
        msgs = []
        msgs.concat(warning_messages(proposal)) if proposal

        issues = msgs.map do |msg|
          Issue.new(msg,
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::ERROR)
        end

        solver_issues = solver_messages.map do |msg|
          Issue.new(msg,
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::ERROR,
            kind:     :solver)
        end

        self.issues = issues + solver_issues
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

        res = []
        res << (_("Found %s dependency issues.") % solve_errors) if solve_errors > 0
        res
      end

      def update_conflicts
        pkg_conflicts = Yast::Pkg.PkgSolveProblems
        @conflicts = []
        pkg_conflicts.each_with_index do |pkg_conflict, index|
          conflict = pkg_conflict
          conflict["id"] = index
          conflict["solutions"].each_with_index do |solution, index2|
            solution["id"] = index2
          end
          @conflicts << conflict
        end

        @conflicts_change_callbacks.each { |c| c.call(@conflicts) }

        @conflicts
      end
    end
  end
end
