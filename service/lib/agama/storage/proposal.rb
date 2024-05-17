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
require "agama/storage/actions"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings_conversion"
require "yast"
require "y2storage"

module Agama
  module Storage
    # Backend class to calculate a storage proposal.
    class Proposal
      include Yast::I18n

      # Settings used for calculating the proposal.
      #
      # @note Some values are recoverd from Y2Storage, see
      #   {ProposalSettingsConversion::FromY2Storage}
      #
      # @return [ProposalSettings, nil] nil if no proposal has been calculated yet.
      attr_reader :settings

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
        calculated? && !proposal.failed?
      end

      # Stores callbacks to be call after calculating a proposal.
      def on_calculate(&block)
        @on_calculate_callbacks << block
      end

      # Available devices for installation.
      #
      # @return [Array<Y2Storage::Device>]
      def available_devices
        disk_analyzer&.candidate_disks || []
      end

      # Calculates a new proposal.
      #
      # @param settings [Agamal::Storage::ProposalSettings] settings to calculate the proposal.
      # @return [Boolean] whether the proposal was correctly calculated.
      def calculate(settings)
        return false unless storage_manager.probed?

        select_target_device(settings) if missing_target_device?(settings)

        calculate_proposal(settings)

        @settings = ProposalSettingsConversion.from_y2storage(proposal.settings, settings)
        @on_calculate_callbacks.each(&:call)

        success?
      end

      # Storage actions.
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def actions
        return [] unless proposal&.devices

        Actions.new(logger, proposal.devices.actiongraph).all
      end

      # List of issues.
      #
      # @return [Array<Issue>]
      def issues
        return [] if !calculated? || success?

        [
          target_device_issue,
          missing_devices_issue,
          proposal_issue
        ].compact
      end

    private

      # @return [Config]
      attr_reader :config

      # @return [Logger]
      attr_reader :logger

      # @return [Y2Storage::MinGuidedProposal, nil]
      def proposal
        storage_manager.proposal
      end

      # Whether the proposal was already calculated.
      #
      # @return [Boolean]
      def calculated?
        !proposal.nil?
      end

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

      # Instantiates and executes a Y2Storage proposal with the given settings
      #
      # @param settings [Y2Storage::ProposalSettings]
      # @return [Y2Storage::GuidedProposal]
      def calculate_proposal(settings)
        proposal = Y2Storage::MinGuidedProposal.new(
          settings:      ProposalSettingsConversion.to_y2storage(settings, config: config),
          devicegraph:   probed_devicegraph,
          disk_analyzer: disk_analyzer
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

      def storage_manager
        Y2Storage::StorageManager.instance
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

      # Returns an issue if the proposal is not valid.
      #
      # @return [Issue, nil]
      def proposal_issue
        return if success?

        Issue.new(_("Cannot accommodate the required file systems for installation"),
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end
    end
  end
end
