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
require "y2storage/agama_proposal"

module Agama
  module Storage
    module ProposalStrategies
      # Strategy for Agama proposal.
      class Agama < Base
        include Yast::I18n

        # @return [Agama::Storage::Config]
        attr_reader :config
        alias_method :settings, :config

        # @param product_config [Agama::Config]
        # @param logger [Logger]
        # @param config [Agama::Storage::Config]
        def initialize(product_config, logger, config)
          textdomain "agama"

          super(product_config, logger)
          @config = config
        end

        # @see Base#calculate
        def calculate
          @proposal = agama_proposal
          @proposal.propose
        ensure
          storage_manager.proposal = @proposal
        end

        # @see Base#issues
        def issues
          return [] unless proposal

          proposal.issues_list
        end

      private

        # @return [Y2Storage::AgamaProposal, nil] Proposal used.
        attr_reader :proposal

        # Instance of the Y2Storage proposal to be used to run the calculation.
        #
        # @return [Y2Storage::AgamaProposal]
        def agama_proposal
          Y2Storage::AgamaProposal.new(config,
            product_config: product_config,
            devicegraph:    probed_devicegraph,
            disk_analyzer:  disk_analyzer,
            issues_list:    [])
        end
      end
    end
  end
end
