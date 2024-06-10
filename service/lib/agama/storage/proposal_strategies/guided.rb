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
require "agama/storage/device_settings"
require "agama/storage/proposal_settings_conversion"

module Agama
  module Storage
    module ProposalStrategies
      # Main strategy for the Agama proposal.
      class Guided < Base
        include Yast::I18n

        # @param config [Config] Agama config
        # @param logger [Logger]
        # @param input_settings [ProposalSettings]
        def initialize(config, logger, input_settings)
          textdomain "agama"

          super(config, logger)
          @input_settings = input_settings
        end

        # Settings used for calculating the proposal.
        #
        # @note Some values are recoverd from Y2Storage, see
        #   {ProposalSettingsConversion::FromY2Storage}
        #
        # @return [ProposalSettings]
        attr_reader :settings

        # @see Base#calculate
        def calculate
          select_target_device(input_settings) if missing_target_device?(input_settings)
          proposal = guided_proposal(input_settings)
          proposal.propose
        ensure
          storage_manager.proposal = proposal
          @settings = ProposalSettingsConversion.from_y2storage(proposal.settings, input_settings)
        end

        # @see Base#issues
        def issues
          return [] unless storage_manager.proposal.failed?

          [target_device_issue, missing_devices_issue].compact
        end

      private

        # Initial set of proposal settings
        # @return [ProposalSettings]
        attr_reader :input_settings

        # Selects the first available device as target device for installation.
        #
        # @param settings [ProposalSettings]
        def select_target_device(settings)
          device = available_devices.first&.name
          return unless device

          case settings.device
          when DeviceSettings::Disk
            settings.device.name = device
          when DeviceSettings::NewLvmVg
            settings.device.candidate_pv_devices = [device]
          when DeviceSettings::ReusedLvmVg
            # TODO: select an existing VG?
          end
        end

        # Whether the given settings has no target device for the installation.
        #
        # @param settings [ProposalSettings]
        # @return [Boolean]
        def missing_target_device?(settings)
          case settings.device
          when DeviceSettings::Disk, DeviceSettings::ReusedLvmVg
            settings.device.name.nil?
          when DeviceSettings::NewLvmVg
            settings.device.candidate_pv_devices.empty?
          end
        end

        # Instance of the Y2Storage proposal to be used to run the calculation.
        #
        # @param settings [Y2Storage::ProposalSettings]
        # @return [Y2Storage::GuidedProposal]
        def guided_proposal(settings)
          Y2Storage::MinGuidedProposal.new(
            settings:      ProposalSettingsConversion.to_y2storage(settings, config: config),
            devicegraph:   probed_devicegraph,
            disk_analyzer: disk_analyzer
          )
        end

        # Returns an issue if there is no target device.
        #
        # @return [Issue, nil]
        def target_device_issue
          return unless missing_target_device?(settings)

          Issue.new(_("No device selected for installation"),
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::ERROR)
        end

        # Returns an issue if any of the devices required for the proposal is not found
        #
        # @return [Issue, nil]
        def missing_devices_issue
          available = available_devices.map(&:name)
          missing = settings.installation_devices.reject { |d| available.include?(d) }

          return if missing.none?

          Issue.new(
            format(
              n_(
                "The following selected device is not found in the system: %{devices}",
                "The following selected devices are not found in the system: %{devices}",
                missing.size
              ),
              devices: missing.join(", ")
            ),
            source:   Issue::Source::CONFIG,
            severity: Issue::Severity::ERROR
          )
        end
      end
    end
  end
end
