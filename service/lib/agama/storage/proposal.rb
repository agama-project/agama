# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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

require "y2storage"
require "y2storage/dialogs/guided_setup/helpers/disk"
require "agama/issue"
require "agama/storage/actions"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_converter"
require "agama/storage/volume_converter"

module Agama
  module Storage
    # Backend class to calculate a storage proposal
    #
    # @example
    #   proposal = Proposal.new(logger, config)
    #   proposal.on_calculate { puts "proposal calculated" }
    #   proposal.calculated_volumes   #=> []
    #
    #   settings = ProposalSettings.new
    #
    #   proposal.calculate(settings)  #=> true
    #   proposal.calculated_volumes   #=> [Volume, Volume]
    class Proposal
      # Settings used for calculating the proposal
      #
      # @return [ProposalSettings, nil]
      attr_reader :settings

      # Constructor
      #
      # @param logger [Logger]
      # @param config [Config] Agama config
      def initialize(logger, config)
        @logger = logger
        @config = config
        @on_calculate_callbacks = []
      end

      # Resets the current proposal
      def reset
        @settings = nil
      end

      # List of issues
      #
      # @return [Array<Issue>]
      def issues
        [
          empty_candidate_devices_issue,
          missing_candidate_devices_issue,
          proposal_issue
        ].compact
      end

      # Stores callbacks to be call after calculating a proposal
      def on_calculate(&block)
        @on_calculate_callbacks << block
      end

      # Available devices for installation
      #
      # @return [Array<Y2Storage::Device>]
      def available_devices
        disk_analyzer.candidate_disks
      end

      # Name of devices where to perform the installation
      #
      # @return [Array<String>]
      def candidate_devices
        return [] unless proposal

        proposal.settings.candidate_devices
      end

      # Label that should be used to represent the given disk in the UI
      #
      # NOTE: this is likely a temporary solution. The label should not be calculated in the backend
      # in the future. See the note about available_devices at {DBus::Storage::Proposal}.
      #
      # The label has the form: "NAME, SIZE, [USB], INSTALLED_SYSTEMS".
      #
      # Examples:
      #
      #   "/dev/sda, 250.00 GiB, Windows, OpenSUSE"
      #   "/dev/sdb, 8.00 GiB, USB"
      #
      # @param device [Y2Storage::Device]
      # @return [String]
      def device_label(device)
        disk_helper.label(device)
      end

      # Volume definitions to be used as templates in the interface
      #
      # Based on the configuration and/or on Y2Storage internals, these volumes may really
      # exist or not in the real context of the proposal and its settings.
      #
      # @return [Array<Volumes>]
      def volume_templates
        converter = VolumeConverter.new(default_specs: default_specs)

        default_specs.map { |s| converter.to_agama(s) }
      end

      # Settings with the data used during the calculation of the storage proposal
      #
      # Not to be confused with the settings passed to {#calculate}, which are used as starting
      # point for creating the settings for the storage proposal.
      #
      # @return [ProposalSettings]
      def calculated_settings
        return nil unless proposal

        to_agama_settings(proposal.settings, devices: proposal.planned_devices || [])
      end

      # Calculates a new proposal
      #
      # @param settings [ProposalSettings, nil] settings to calculate the proposal
      # @return [Boolean] whether the proposal was correctly calculated
      def calculate(settings = nil)
        @settings = settings || ProposalSettings.new
        @settings.freeze
        y2storage_settings = to_y2storage_settings(@settings)

        @proposal = new_proposal(y2storage_settings)
        storage_manager.proposal = proposal

        @on_calculate_callbacks.each(&:call)

        !proposal.failed?
      end

      # Storage actions
      #
      # @return [Array<Y2Storage::CompoundAction>]
      def actions
        return [] unless proposal&.devices

        Actions.new(logger, proposal.devices.actiongraph).all
      end

    private

      # @return [Logger]
      attr_reader :logger

      # @return [Config]
      attr_reader :config

      # @return [Y2Storage::MinGuidedProposal]
      attr_reader :proposal

      # Instantiates and executes a Y2Storage proposal with the given settings
      #
      # @param proposal_settings [Y2Storage::ProposalSettings]
      # @return [Y2Storage::GuidedProposal]
      def new_proposal(proposal_settings)
        guided = Y2Storage::MinGuidedProposal.new(
          settings:      proposal_settings,
          devicegraph:   probed_devicegraph,
          disk_analyzer: disk_analyzer
        )
        guided.propose
        guided
      end

      # Volume specs to use by default
      #
      # These specs are used for generating volume templates and also for calculating the storage
      # proposal settings.
      #
      # @see #volume_templates
      # @see ProposalSettingsGenerator
      #
      # @return [Array<Y2Storage::VolumeSpecification>]
      def default_specs
        specs = specs_from_config
        return specs if specs.any?

        Y2Storage::ProposalSettings.new_for_current_product.volumes
      end

      # Volume specs from the Agama config file
      #
      # @return [Array<Y2Storage::VolumeSpecification>]
      def specs_from_config
        config_volumes = config.data.fetch("storage", {}).fetch("volumes", [])
        config_volumes.map { |v| Y2Storage::VolumeSpecification.new(v) }
      end

      # Converts a Agama::Storage::ProposalSettings object to its equivalent
      # Y2Storage::ProposalSettings one
      #
      # @param settings [ProposalSettings]
      # @return [Y2Storage::ProposalSettings]
      def to_y2storage_settings(settings)
        y2storage_settings =
          ProposalSettingsConverter.new(default_specs: default_specs).to_y2storage(settings)
        adjust_encryption(y2storage_settings)
        force_cleanup(y2storage_settings)
        y2storage_settings
      end

      # Converts a Y2Storage::ProposalSettings object to its equivalent
      # Agama::Storage::ProposalSettings one
      #
      # @param settings [Y2Storage::ProposalSettings]
      # @param devices [Array<Y2Storage::Planned::Device>]
      #
      # @return [ProposalSettings]
      def to_agama_settings(settings, devices: [])
        converter = ProposalSettingsConverter.new(default_specs: default_specs)
        converter.to_agama(settings, devices: devices)
      end

      # @return [Y2Storage::DiskAnalyzer]
      def disk_analyzer
        storage_manager.probed_disk_analyzer
      end

      # Helper to generate a disk label
      #
      # @return [Y2Storage::Dialogs::GuidedSetup::Helpers::Disk]
      def disk_helper
        @disk_helper ||= Y2Storage::Dialogs::GuidedSetup::Helpers::Disk.new(disk_analyzer)
      end

      # Devicegraph representing the system
      #
      # @return [Y2Storage::Devicegraph]
      def probed_devicegraph
        storage_manager.probed
      end

      def storage_manager
        Y2Storage::StorageManager.instance
      end

      # Returns an issue if there is no candidate device
      #
      # @return [Issue, nil]
      def empty_candidate_devices_issue
        return if !proposal || candidate_devices.any?

        Issue.new("No devices are selected for installation",
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end

      # Returns an issue if any of the candidate devices is not found
      #
      # @return [Issue, nil]
      def missing_candidate_devices_issue
        available_names = available_devices.map(&:name)
        missing = candidate_devices - available_names
        return if missing.none?

        Issue.new("Some selected devices are not found in the system",
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end

      # Returns an issue if the proposal is not valid
      #
      # @return [Issue, nil]
      def proposal_issue
        return unless proposal&.failed?

        Issue.new("Cannot accommodate the required file systems for installation",
          source:   Issue::Source::CONFIG,
          severity: Issue::Severity::ERROR)
      end

      # Adjusts the encryption-related settings of the given Y2Storage::ProposalSettings object
      #
      # @param settings [Y2Storage::ProposalSettings]
      def adjust_encryption(settings)
        enc_config = config.data.fetch("storage", {}).fetch("encryption", {})

        method = Y2Storage::EncryptionMethod.find(enc_config["method"] || "")
        settings.encryption_method = method if method

        pbkdf = Y2Storage::PbkdFunction.find(enc_config["pbkdf"])
        settings.encryption_pbkdf = pbkdf if pbkdf
      end

      # Temporary method to enforce a destructive proposal
      #
      # TODO: there is still no way to define which partitions or LVM structures should be kept
      # or reused, so let's enforce a clean install for now.
      #
      # @param settings [Y2Storage::ProposalSettings]
      def force_cleanup(settings)
        settings.windows_delete_mode = :all
        settings.linux_delete_mode = :all
        settings.other_delete_mode = :all
        # Setting #linux_delete_mode to :all is not enough to prevent VG reusing in all cases
        settings.lvm_vg_reuse = false
      end
    end
  end
end
