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

require "agama/storage/proposal_strategies/base"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_reader"
require "agama/storage/proposal_settings_conversion"

module Agama
  module Storage
    module ProposalStrategies
      # Backend class to calculate a storage proposal.
      class Autoyast < Base
        include Yast::I18n

        # @param config [Config] Agama config
        # @param logger [Logger]
        def initialize(config, logger, partitioning)
          textdomain "agama"

          super(config, logger)
          @partitioning = partitioning
        end

        # Settings used for calculating the proposal.
        #
        attr_reader :partitioning
        alias_method :settings, :partitioning

        # Calculates a new proposal.
        def calculate
          proposal = Y2Storage::AutoinstProposal.new(
            partitioning:      partitioning,
            proposal_settings: proposal_settings,
            devicegraph:       probed_devicegraph,
            disk_analyzer:     disk_analyzer
          )
          proposal.propose
          storage_manager.proposal = proposal
        end

        # List of issues.
        #
        # @return [Array<Issue>]
        def issues
          # TODO
          []
        end

      private
        # Default proposal settings, potentially used to calculate omitted information
        #
        # @return [Y2Storage::ProposalSettings]
        def proposal_settings
          agama_default = ProposalSettingsReader.new(config).read
          ProposalSettingsConversion.to_y2storage(agama_default, config: config)
        end
      end
    end
  end
end
