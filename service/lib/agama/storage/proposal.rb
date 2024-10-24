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
require "agama/storage/config_conversions/to_json"
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

      # @param product_config [Agama::Config] Agama config
      # @param logger [Logger]
      def initialize(product_config, logger: nil)
        textdomain "agama"

        @product_config = product_config
        @logger = logger || Logger.new($stdout)
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

      # Storage JSON config from the current proposal, if any.
      #
      # @param solved [Boolean] Whether to get the solved config.
      # @return [Hash] JSON config according to the JSON schema.
      def storage_json(solved: false)
        return source_json if !solved && source_json

        case strategy
        when ProposalStrategies::Guided
          {
            storage: {
              guided: strategy.settings.to_json_settings
            }
          }
        when ProposalStrategies::Agama
          config = config(solved: solved)
          {
            storage: ConfigConversions::ToJSON.new(config).convert
          }
        when ProposalStrategies::Autoyast
          strategy.settings
        else
          {}
        end
      end

      # Calculates a new proposal using the given JSON.
      #
      # @raise If the JSON is not valid.
      #
      # @param source_json [Hash] Source JSON config according to the JSON schema.
      # @return [Boolean] Whether the proposal successes.
      def calculate_from_json(source_json)
        # @todo Validate source_json with JSON schema.

        guided_json = source_json.dig(:storage, :guided)
        storage_json = source_json[:storage]
        autoyast_json = source_json[:legacyAutoyastStorage]

        if guided_json
          calculate_guided_from_json(guided_json)
        elsif storage_json
          calculate_agama_from_json(storage_json)
        elsif autoyast_json
          calculate_autoyast(autoyast_json)
        else
          raise "Invalid JSON config: #{source_json}"
        end

        @source_json = source_json
        success?
      end

      # Calculates a new proposal using the guided strategy.
      #
      # @param settings [Agama::Storage::ProposalSettings]
      # @return [Boolean] Whether the proposal successes.
      def calculate_guided(settings)
        logger.info("Calculating proposal with guided strategy: #{settings.inspect}")
        reset
        @strategy = ProposalStrategies::Guided.new(product_config, logger, settings)
        calculate
      end

      # Calculates a new proposal using the agama strategy.
      #
      # @param config [Agama::Storage::Config]
      # @return [Boolean] Whether the proposal successes.
      def calculate_agama(config)
        logger.info("Calculating proposal with agama strategy: #{config.inspect}")
        reset
        @source_config = config.copy
        @strategy = ProposalStrategies::Agama.new(product_config, logger, config)
        calculate
      end

      # Calculates a new proposal using the autoyast strategy.
      #
      # @param partitioning [Array<Hash>] Hash-based representation of the <partitioning> section
      #   of the AutoYaST profile.
      # @return [Boolean] Whether the proposal successes.
      def calculate_autoyast(partitioning)
        logger.info("Calculating proposal with autoyast strategy: #{partitioning}")
        reset
        # Ensures keys are strings.
        partitioning = JSON.parse(partitioning.to_json)
        @strategy = ProposalStrategies::Autoyast.new(product_config, logger, partitioning)
        calculate
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

        items.concat(strategy.issues) if strategy
        items
      end

      # Whether the guided strategy was used for calculating the current proposal.
      #
      # @return [Boolean]
      def guided?
        return false unless calculated?

        strategy.is_a?(ProposalStrategies::Guided)
      end

      # Settings used for calculating the guided proposal, if any.
      #
      # @return [ProposalSettings, nil]
      def guided_settings
        return unless guided?

        strategy.settings
      end

    private

      # @return [Agama::Config]
      attr_reader :product_config

      # @return [Logger]
      attr_reader :logger

      # @return [ProposalStrategies::Base]
      attr_reader :strategy

      # Source JSON config without processing.
      #
      # @return [Hash, nil] nil if no proposal has been calculated from JSON.
      attr_reader :source_json

      # Source storage config without solving.
      #
      # @return [Storage::Config, nil] nil if no agama proposal has been calculated.
      attr_reader :source_config

      # Resets values.
      def reset
        @strategy = nil
        @source_json = nil
        @source_config = nil
      end

      # Storage config used for calculating the proposal (only for Agama strategy).
      #
      # @param solved [Boolean] Whether to get solved config.
      # @return [Storage::Config, nil] nil if no agama proposal has been calculated.
      def config(solved: false)
        return unless strategy.is_a?(ProposalStrategies::Agama)

        solved ? strategy.config : source_config
      end

      # Calculates a proposal from guided JSON settings.
      #
      # @param guided_json [Hash] e.g., { "target": { "disk": "/dev/vda" } }.
      # @return [Boolean] Whether the proposal successes.
      def calculate_guided_from_json(guided_json)
        settings = ProposalSettings.new_from_json(guided_json, config: product_config)
        calculate_guided(settings)
      end

      # Calculates a proposal from storage JSON settings.
      #
      # @param config_json [Hash] e.g., { "drives": [] }.
      # @return [Boolean] Whether the proposal successes.
      def calculate_agama_from_json(config_json)
        config = ConfigConversions::FromJSON.new(
          config_json,
          default_paths:   product_config.default_paths,
          mandatory_paths: product_config.mandatory_paths
        ).convert

        calculate_agama(config)
      end

      # Calculates a new proposal with the assigned strategy.
      #
      # @return [Boolean] Whether the proposal successes.
      def calculate
        return false unless storage_manager.probed?

        @calculate_error = nil
        begin
          strategy.calculate
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
