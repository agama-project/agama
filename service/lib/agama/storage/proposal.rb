# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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

require "agama/issue"
require "agama/storage/actions"
require "agama/storage/proposal_strategies"
require "yast"
require "y2storage"

module Agama
  module Storage
    # Backend class to calculate a storage proposal.
    class Proposal
      include Yast::I18n

      # @param config [Config] Agama config
      # @param logger [Logger]
      def initialize(config, logger: nil)
        textdomain "agama"

        @config = config
        @logger = logger || Logger.new($stdout)
        @issues = []
        @on_calculate_callbacks = []
      end

      # List of issues.
      #
      # @return [Array<Issue>]
      attr_reader :issues

      # Whether the proposal was already calculated.
      #
      # @return [Boolean]
      def calculated?
        !proposal.nil?
      end

      # Whether the proposal was successfully calculated.
      #
      # @return [Boolean]
      def success?
        calculated? && !proposal.failed? && issues.none?(&:error?)
      end

      # Stores callbacks to be called after calculating a proposal.
      def on_calculate(&block)
        @on_calculate_callbacks << block
      end

      # Available devices for installation.
      #
      # @return [Array<Y2Storage::Device>]
      def available_devices
        disk_analyzer&.candidate_disks || []
      end

      # Settings used to calculate the current proposal.
      #
      # The type depends on the kind of proposal, see {#calculate_guided} and {#calculate_autoyast}.
      #
      # @return [Agama::Storage::ProposalSettings, Array<Hash>]
      def settings
        return unless calculated?

        strategy_object.settings
      end

      # Calculates a new guided proposal.
      #
      # @param settings [Agama::Storage::ProposalSettings] settings to calculate the proposal.
      # @return [Boolean] whether the proposal was correctly calculated.
      def calculate_guided(settings)
        @strategy_object = ProposalStrategies::Guided.new(config, logger, settings)
        calculate
      end

      # Calculates a new legacy AutoYaST proposal.
      #
      # @param partitioning [Array<Hash>] Hash-based representation of the <partitioning> section
      #   of the AutoYaST profile
      # @return [Boolean] whether the proposal was correctly calculated.
      def calculate_autoyast(partitioning)
        @strategy_object = ProposalStrategies::Autoyast.new(config, logger, partitioning)
        calculate
      end

      # Storage actions.
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def actions
        return [] unless proposal&.devices

        Actions.new(logger, proposal.devices.actiongraph).all
      end

      # Whether the current proposal was calculated the given strategy (:autoyast or :guided).
      #
      # @param id [#downcase]
      # @return [Boolean]
      def strategy?(id)
        return false unless calculated?

        id.downcase.to_sym == strategy_object.id
      end

    private

      # @return [Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      attr_reader :strategy_object

      # Calculates a new proposal.
      #
      # @return [Boolean] whether the proposal was correctly calculated.
      def calculate
        return false unless storage_manager.probed?

        @issues = []

        begin
          strategy_object.calculate
          @issues << failed_issue if proposal.failed?
        rescue Y2Storage::Error => e
          handle_exception(e)
        end

        @issues.concat(strategy_object.issues)
        @on_calculate_callbacks.each(&:call)
        success?
      end

      # @return [Y2Storage::Proposal::Base, nil]
      def proposal
        storage_manager.proposal
      end

      # @return [Y2Storage::DiskAnalyzer, nil] nil if the system is not probed yet.
      def disk_analyzer
        return unless storage_manager.probed?

        storage_manager.probed_disk_analyzer
      end

      # @return [Y2Storage::StorageManager]
      def storage_manager
        Y2Storage::StorageManager.instance
      end

      # Handle Y2Storage exceptions
      def handle_exception(error)
        case error
        when Y2Storage::NoDiskSpaceError
          @issues << failed_issue
        when Y2Storage::Error
          @issues << exception_issue(error)
        else
          raise error
        end
      end

      # Issue representing the proposal is not valid.
      #
      # @return [Issue]
      def failed_issue
        Issue.new(
          _("Cannot accommodate the required file systems for installation"),
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR
        )
      end

      # Issue to communicate a generic Y2Storage error.
      #
      # @return [Issue]
      def exception_issue(error)
        Issue.new(
          _("A problem ocurred while calculating the storage setup"),
          details:  error.message,
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR
        )
      end
    end
  end
end
