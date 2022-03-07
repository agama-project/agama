# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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

require "singleton"
require "y2storage/storage_manager"
require "y2storage/guided_proposal"
require "y2storage/proposal_settings"

module DInstaller
  module Storage
    # Backend class to calculate a storage proposal
    class Proposal
      include Singleton

      class NoProposalError < StandardError; end

      def available_devices
        disk_analyzer.candidate_disks
      end

      def candidate_devices
        raise NoProposalError unless proposal

        proposal.settings.candidate_devices
      end

      def lvm?
        raise NoProposalError unless proposal

        proposal.settings.use_lvm
      end

      def success?
        raise NoProposalError unless proposal

        !proposal.failed?
      end

      def calculate(settings = {})
        proposal_settings = generate_proposal_settings(settings)

        @proposal = Y2Storage::GuidedProposal.initial(
          settings:      proposal_settings,
          devicegraph:   probed_devicegraph,
          disk_analyzer: disk_analyzer
        )

        save unless proposal.failed?
      end

    private

      attr_reader :proposal

      def generate_proposal_settings(settings)
        proposal_settings = Y2Storage::ProposalSettings.new_for_current_product

        settings.each { |k, v| proposal_settings.public_send("#{k}=", v) }

        proposal_settings
      end

      def save
        Y2Storage::StorageManager.instance.proposal = proposal
      end

      def disk_analyzer
        Y2Storage::StorageManager.instance.probed_disk_analyzer
      end

      def probed_devicegraph
        Y2Storage::StorageManager.instance.probed
      end
    end
  end
end
