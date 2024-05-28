# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_reader"
require "agama/storage/proposal_settings_conversion"
require "yast"
require "y2storage"

module Agama
  module Storage
    # Backend class to use the legacy AutoYaST proposal
    class AutoyastProposal
      include Yast::I18n

      # @param config [Config] Agama config
      # @param logger [Logger]
      def initialize(config, logger: nil)
        textdomain "agama"

        @config = config
        @logger = logger || Logger.new($stdout)
        @on_calculate_callbacks = []
      end

      # Whether the proposal was successfully calculated.
      #
      # @return [Boolean]
      def success?
        calculated? && !autoyast_proposal.failed?
      end

      # Stores callbacks to be call after calculating a proposal.
      def on_calculate(&block)
        @on_calculate_callbacks << block
      end

      # Calculates a new proposal.
      #
      # @param partitioning [Array<Hash>] Hash-based representation of the <partitioning> section
      #   of the AutoYaST profile
      # @return [Boolean] whether the proposal was correctly calculated.
      def calculate(partitioning)
        return false unless storage_manager.probed?

        calculate_proposal(partitioning)
        @on_calculate_callbacks.each(&:call)
        success?
      end

      # Storage actions.
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def actions
        return [] unless autoyast_proposal&.devices

        Actions.new(logger, autoyast_proposal.devices.actiongraph).all
      end

      # List of issues.
      #
      # @return [Array<Issue>]
      def issues
        return [] if !calculated? || success?

        # TODO
        []
      end

    private

      # @return [Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      # @return [Y2Storage::AutoinstProposal, nil]
      def autoyast_proposal
        storage_manager.proposal
      end

      # Whether the proposal was already calculated.
      #
      # @return [Boolean]
      def calculated?
        !autoyast_proposal.nil?
      end

      # Instantiates and executes an AutoYaST proposal with the given partitioning section
      #
      # @param partitioning [Array<Hash>] see {#calculate}
      # @return [Y2Storage::AutoinstProposal]
      def calculate_proposal(partitioning)
        proposal = Y2Storage::AutoinstProposal.new(
          partitioning:      partitioning,
          proposal_settings: proposal_settings,
          devicegraph:       probed_devicegraph,
          disk_analyzer:     disk_analyzer
        )
        proposal.propose
        storage_manager.proposal = proposal
      end

      # @return [Y2Storage::DiskAnalyzer, nil] nil if the system is not probed yet.
      def disk_analyzer
        return nil unless storage_manager.probed?

        storage_manager.probed_disk_analyzer
      end

      # Devicegraph representing the system
      #
      # @return [Y2Storage::Devicegraph, nil] nil if the system is not probed yet.
      def probed_devicegraph
        return nil unless storage_manager.probed?

        storage_manager.probed
      end

      # Default proposal settings, potentially used to calculate omitted information
      #
      # @return [Y2Storage::ProposalSettings]
      def proposal_settings
        agama_default = ProposalSettingsReader.new(config).read
        default = ProposalSettingsConversion.to_y2storage(agama_default, config: config)
        # default.candidate_devices = nil
        default
      end

      # @return [Y2Storage::StorageManager]
      def storage_manager
        Y2Storage::StorageManager.instance
      end
    end
  end
end
