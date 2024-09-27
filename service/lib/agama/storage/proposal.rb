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
require "agama/storage/actions_generator"
require "agama/storage/config_conversions/from_json"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_strategies"
require "json"
require "yast"
require "y2storage"

module Agama
  module Storage
    # Class used for calculating a storage proposal.
    class Proposal
      include Yast::I18n

      # @param config [Agama::Config] Agama config
      # @param logger [Logger]
      def initialize(config, logger: nil)
        textdomain "agama"

        @config = config
        @logger = logger || Logger.new($stdout)
        @issues = []
        @on_calculate_callbacks = []
      end

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

      # Storage config from the current proposal, if any.
      #
      # @return [Hash] Storage config according to JSON schema.
      def config_json
        return {} unless calculated?

        case strategy_object
        when ProposalStrategies::Guided
          {
            storage: {
              guided: strategy_object.settings.to_json_settings
            }
          }
        when ProposalStrategies::Agama
          # @todo Convert config to JSON if there is no raw config.
          raw_config || {}
        when ProposalStrategies::Autoyast
          raw_config
        else
          {}
        end
      end

      # Calculates a new proposal using the guided strategy.
      #
      # @param settings [Agama::Storage::ProposalSettings]
      # @return [Boolean] Whether the proposal successes.
      def calculate_guided(settings)
        logger.info("Calculating proposal with guided strategy: #{settings.inspect}")
        @raw_config = nil
        @strategy_object = ProposalStrategies::Guided.new(config, logger, settings)
        calculate
      end

      # Calculates a new proposal using the agama strategy.
      #
      # @param storage_config [Agama::Storage::Config]
      # @return [Boolean] Whether the proposal successes.
      def calculate_agama(storage_config)
        logger.info("Calculating proposal with agama strategy: #{storage_config.inspect}")
        @raw_config = nil
        @strategy_object = ProposalStrategies::Agama.new(config, logger, storage_config)
        calculate
      end

      # Calculates a new proposal using the autoyast strategy.
      #
      # @param partitioning [Array<Hash>] Hash-based representation of the <partitioning> section
      #   of the AutoYaST profile.
      # @return [Boolean] Whether the proposal successes.
      def calculate_autoyast(partitioning)
        logger.info("Calculating proposal with autoyast strategy: #{partitioning}")
        @raw_config = nil
        # Ensures keys are strings.
        partitioning = JSON.parse(partitioning.to_json)
        @strategy_object = ProposalStrategies::Autoyast.new(config, logger, partitioning)
        calculate
      end

      # Calculates a new proposal using the given JSON config.
      #
      # @raise If the config is not valid.
      #
      # @param config_json [Hash] Storage config according to the JSON schema.
      # @return [Boolean] Whether the proposal successes.
      def calculate_from_json(config_json)
        # @todo Validate config_json with JSON schema.

        guided_json = config_json.dig(:storage, :guided)
        storage_json = config_json[:storage]
        autoyast_json = config_json[:legacyAutoyastStorage]

        if guided_json
          calculate_guided_from_json(guided_json)
        elsif storage_json
          calculate_agama_from_json(storage_json)
        elsif autoyast_json
          calculate_autoyast(autoyast_json)
        else
          raise "Invalid storage config: #{config_json}"
        end

        @raw_config = config_json
        success?
      end

      # Storage actions.
      #
      # @return [Array<Action>]
      def actions
        return [] unless proposal&.devices

        probed = storage_manager.probed
        target = proposal.devices

        ActionsGenerator.new(probed, target).generate
      end

      # Whether the guided strategy was used for calculating the current proposal.
      #
      # @return [Boolean]
      def guided?
        return false unless calculated?

        strategy_object.is_a?(ProposalStrategies::Guided)
      end

      # Settings used for calculating the guided proposal, if any.
      #
      # @return [ProposalSettings, nil]
      def guided_settings
        return unless guided?

        strategy_object.settings
      end

      # List of issues.
      #
      # @return [Array<Issue>]
      def issues
        items = []

        case @calculate_error
        when Y2Storage::NoDiskSpaceError
          items << failed_issue
        when Y2Storage::Error
          items << exception_issue(@calculate_error)
        else
          items << failed_issue if proposal&.failed?
        end

        items.concat(strategy_object.issues) if strategy_object
        items
      end

    private

      # @return [Agama::Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      # @return [ProposalStrategies::Base]
      attr_reader :strategy_object

      # @return [Hash] JSON config without processing.
      attr_reader :raw_config

      # Calculates a proposal from guided JSON settings.
      #
      # @param guided_json [Hash] e.g., { "target": { "disk": "/dev/vda" } }.
      # @return [Boolean] Whether the proposal successes.
      def calculate_guided_from_json(guided_json)
        settings = ProposalSettings.new_from_json(guided_json, config: config)
        calculate_guided(settings)
      end

      # Calculates a proposal from storage JSON settings.
      #
      # @param storage_json [Hash] e.g., { "drives": [] }.
      # @return [Boolean] Whether the proposal successes.
      def calculate_agama_from_json(storage_json)
        storage_config = ConfigConversions::FromJSON
          .new(storage_json, product_config: config)
          .convert
        calculate_agama(storage_config)
      end

      # Calculates a new proposal with the assigned strategy.
      #
      # @return [Boolean] Whether the proposal successes.
      def calculate
        return false unless storage_manager.probed?

        @calculate_error = nil
        begin
          strategy_object.calculate
        rescue Y2Storage::Error => e
          @calculate_error = e
        rescue StandardError => e
          raise e
        end

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
