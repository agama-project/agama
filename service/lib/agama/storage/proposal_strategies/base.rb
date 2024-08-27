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
require "yast"
require "y2storage"

module Agama
  module Storage
    module ProposalStrategies
      # Base class for the strategies used by the Agama proposal.
      class Base
        # @param config [Config] Agama config
        # @param logger [Logger]
        def initialize(config, logger)
          @config = config
          @logger = logger
        end

        # Settings used for calculating the proposal.
        def settings
          raise NotImplementedError
        end

        # Calculates a new proposal, storing the result at the storage manager.
        #
        # @raise [Y2Storage::NoDiskSpaceError] if it was not possible to calculate the proposal
        # @raise [Y2Storage::Error] if something went wrong while calculating the proposal
        def calculate
          raise NotImplementedError
        end

        # List of issues.
        #
        # @return [Array<Issue>]
        def issues
          []
        end

      private

        # @return [Config]
        attr_reader :config

        # @return [Logger]
        attr_reader :logger

        # @return [Y2Storage::DiskAnalyzer, nil] nil if the system is not probed yet.
        def disk_analyzer
          return nil unless storage_manager.probed?

          storage_manager.probed_disk_analyzer
        end

        # Available devices for installation.
        #
        # @return [Array<Y2Storage::Device>]
        def available_devices
          disk_analyzer&.candidate_disks || []
        end

        # Devicegraph representing the system
        #
        # @return [Y2Storage::Devicegraph, nil] nil if the system is not probed yet.
        def probed_devicegraph
          return nil unless storage_manager.probed?

          storage_manager.probed
        end

        # @return [Y2Storage::StorageManager]
        def storage_manager
          Y2Storage::StorageManager.instance
        end
      end
    end
  end
end
