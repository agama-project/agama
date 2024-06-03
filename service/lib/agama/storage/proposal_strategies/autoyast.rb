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
        # @param [Array<Hash>]
        attr_reader :partitioning
        alias_method :settings, :partitioning

        # Calculates a new proposal.
        def calculate
          @ay_issues = ::Installation::AutoinstIssues::List.new
          proposal = Y2Storage::AutoinstProposal.new(
            partitioning:      partitioning,
            proposal_settings: proposal_settings,
            devicegraph:       probed_devicegraph,
            disk_analyzer:     disk_analyzer,
            issues_list:       ay_issues
          )
          proposal.propose
        rescue Y2Storage::Error => e
          handle_exception(e)
        ensure
          storage_manager.proposal = proposal
        end

        # List of issues.
        #
        # @return [Array<Issue>]
        def issues
          ay_issues.map { |i| agama_issue(i) }
        end

      private

        attr_reader :ay_issues

        # Default proposal settings, potentially used to calculate omitted information
        #
        # @return [Y2Storage::ProposalSettings]
        def proposal_settings
          agama_default = ProposalSettingsReader.new(config).read
          ProposalSettingsConversion.to_y2storage(agama_default, config: config)
        end

        # Handle Y2Storage exceptions
        #
        # Some of the exceptions can be handled as an AutoYaST problem in order to offer further
        # information to the user. For the rest of cases, the exception is catched here and
        # reported in a best-effort way (maybe without translation, for instance).
        def handle_exception(error)
          logger.warn "AutoYaST proposal failed: #{error.inspect}"
          case error
          when Y2Storage::NoDiskSpaceError
            ay_issues.add(Y2Storage::AutoinstIssues::NoDiskSpace)
          when Y2Storage::Error
            ay_issues.add(Y2Storage::AutoinstIssues::Exception, error)
          else
            raise error
          end
        end

        # Agama issue equivalent to the given AutoYaST issue
        def agama_issue(ay_issue)
          Issue.new(
            ay_issue.message,
            source: Issue::Source::CONFIG,
            severity: ay_issue.warn? ? Issue::Severity::WARN : Issue::Severity::ERROR
          )
        end
      end
    end
  end
end
