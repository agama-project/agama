# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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
require "agama/storage/config_checker"
require "agama/storage/config_conversions"
require "agama/storage/config_json_generator"
require "agama/storage/config_solver"
require "agama/storage/model_support_checker"
require "agama/storage/proposal_strategies"
require "agama/storage/issue_classes"
require "agama/storage/system"
require "json"
require "yast"
require "y2storage"

module Agama
  module Storage
    # Class used for calculating a storage proposal.
    class Proposal
      include Yast::I18n

      # @return [Agama::Config]
      attr_accessor :product_config

      # @param product_config [Agama::Config] Agama config
      # @param logger [Logger]
      def initialize(product_config, logger: nil)
        textdomain "agama"

        @product_config = product_config
        @logger = logger || Logger.new($stdout)
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
        calculated? && !proposal.failed? && issues.none?
      end

      # Default storage config according to the JSON schema.
      #
      # The default config depends on the target device.
      #
      # @param device [Y2Storage::Device, nil] Target device.
      # @return [Hash]
      def default_storage_json(device = nil)
        config_json = ConfigJSONGenerator.new(product_config, device: device).generate

        { storage: config_json }
      end

      # Storage config according to the JSON schema from the current proposal.
      #
      # @return [Hash, nil] nil if there is no proposal yet.
      def storage_json
        case strategy
        when ProposalStrategies::Agama
          source_json || { storage: ConfigConversions::ToJSON.new(config).convert }
        when ProposalStrategies::Autoyast
          source_json || {
            legacyAutoyastStorage: JSON.parse(strategy.settings.to_json, symbolize_names: true)
          }
        end
      end

      # Config model according to the JSON schema.
      #
      # The config model is generated only if all the config features are supported by the model.
      #
      # @return [Hash, nil] nil if the config model cannot be generated.
      def model_json
        config = config(solved: true)
        return unless config && model_supported?(config)

        ConfigConversions::ToModel.new(config, product_config).convert
      end

      # Solves a given model.
      #
      # @param model_json [Hash] Config model according to the JSON schema.
      # @return [Hash, nil] Solved config model or nil if the model cannot be solved yet.
      def solve_model(model_json)
        return unless storage_manager.probed?

        config = ConfigConversions::FromModel
          .new(model_json, product_config: product_config, storage_system: storage_system)
          .convert

        ConfigSolver.new(product_config, storage_system).solve(config)
        ConfigConversions::ToModel.new(config, product_config).convert
      end

      # Calculates a new proposal using the given JSON.
      #
      # @raise If the JSON is not valid.
      #
      # @param source_json [Hash] Source JSON config according to the JSON schema.
      # @return [Boolean] Whether the proposal successes.
      def calculate_from_json(source_json)
        # @todo Validate source_json with JSON schema.

        storage_json = source_json[:storage]
        autoyast_json = source_json[:legacyAutoyastStorage]

        if storage_json
          calculate_agama_from_json(storage_json)
        elsif autoyast_json
          calculate_autoyast(autoyast_json)
        else
          raise "Invalid JSON config: #{source_json}"
        end

        @source_json = source_json
        success?
      end

      # Calculates a new proposal using the agama strategy.
      #
      # @param config [Agama::Storage::Config]
      # @return [Boolean] Whether the proposal successes.
      def calculate_agama(config)
        logger.info("Calculating proposal with agama strategy: #{config.inspect}")
        reset
        @source_config = config.copy
        @strategy = ProposalStrategies::Agama.new(product_config, storage_system, config, logger)
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
        @strategy = ProposalStrategies::Autoyast
          .new(product_config, storage_system, partitioning, logger)
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
      # @return [Boolean] Always false because the guided strategy does not longer exists
      def guided?
        false
      end

      # @return [Storage::System]
      def storage_system
        @storage_system ||= Storage::System.new
      end

    private

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

      # Whether the config model supports all features of the given config.
      #
      # @param config [Storage::Config]
      # @return [Boolean]
      def model_supported?(config)
        ModelSupportChecker.new(config).supported?
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

        success?
      end

      # @return [Y2Storage::Proposal::Base, nil]
      def proposal
        storage_manager.proposal
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
          _("Cannot calculate a valid storage setup with the current configuration"),
          kind: IssueClasses::PROPOSAL
        )
      end

      # Issue to communicate a generic Y2Storage error.
      #
      # @return [Issue]
      def exception_issue(error)
        Issue.new(
          _("A problem ocurred while calculating the storage setup"),
          kind:    IssueClasses::PROPOSAL,
          details: error.message
        )
      end
    end
  end
end
