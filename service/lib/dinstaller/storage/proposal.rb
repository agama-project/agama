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

require "y2storage"
require "y2storage/dialogs/guided_setup/helpers/disk"
require "dinstaller/with_progress"
require "dinstaller/validation_error"
require "dinstaller/storage/actions"
require "dinstaller/storage/proposal_settings"
require "dinstaller/storage/proposal_settings_converter"
require "dinstaller/storage/volume_converter"

module DInstaller
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
      include WithProgress

      # Settings that were used to calculate the proposal
      #
      # @return [ProposalSettings, nil]
      attr_reader :settings

      # Constructor
      #
      # @param logger [Logger]
      # @param config [Config] D-Installer config
      def initialize(logger, config)
        @logger = logger
        @config = config
        @on_calculate_callbacks = []
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
        VolumesGenerator.new(default_specs).volumes
      end

      # Volumes from the specs used during the calculation of the storage proposal
      #
      # Not to be confused with settings.volumes, which are used as starting point for creating the
      # volume specs for the storage proposal.
      #
      # @return [Array<Volumes>]
      def calculated_volumes
        return [] unless proposal

        generator = VolumesGenerator.new(specs_from_proposal,
          planned_devices: proposal.planned_devices)
        volumes = generator.volumes(only_proposed: true)

        # FIXME: setting this should be a responsibility of VolumesGenerator or any other component,
        # but this is good enough until we implement fine-grained control on encryption
        volumes.each { |v| v.encrypted = proposal.settings.use_encryption }

        volumes
      end

      # Calculates a new proposal
      #
      # @param settings [ProposalSettings] settings to calculate the proposal
      # @return [Boolean] whether the proposal was correctly calculated
      def calculate(settings = nil)
        @settings = settings || ProposalSettings.new
        @settings.freeze
        proposal_settings = to_y2storage_settings(@settings)

        # FIXME: by now, use only one disk
        if proposal_settings.candidate_devices.nil?
          first_disk = available_devices.first&.name
          proposal_settings.candidate_devices = [first_disk] if first_disk
        end

        @proposal = new_proposal(proposal_settings)
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

      # Validates the storage proposal
      #
      # @return [Array<ValidationError>] List of validation errors
      def validate
        return [] if proposal.nil?

        [
          validate_proposal,
          validate_available_devices,
          validate_candidate_devices
        ].compact
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

      # Volume specs from the D-Installer config file
      #
      # @return [Array<Y2Storage::VolumeSpecification>]
      def specs_from_config
        config_volumes = config.data.fetch("storage", {}).fetch("volumes", [])
        config_volumes.map { |v| Y2Storage::VolumeSpecification.new(v) }
      end

      # Volume specs from the setting used for the storage proposal
      #
      # @return [Array<Y2Storage::VolumeSpecification>]
      def specs_from_proposal
        return [] unless proposal

        proposal.settings.volumes
      end

      # Converts a DInstaller::Storage::ProposalSettings object to its equivalent
      # Y2Storage::ProposalSettings one
      #
      # @param settings [ProposalSettings]
      # @return [Y2Storage::ProposalSettings]
      def to_y2storage_settings(settings)
        ProposalSettingsConverter.new(default_specs: default_specs).to_y2storage(settings)
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

      def validate_proposal
        return if candidate_devices.empty? || !proposal.failed?

        message = format(
          "Could not create a storage proposal using %{devices}",
          devices: candidate_devices.join(", ")
        )
        ValidationError.new(message)
      end

      def validate_available_devices
        return if available_devices.any?

        ValidationError.new("Could not find a suitable device for installation")
      end

      def validate_candidate_devices
        return if available_devices.empty? || candidate_devices.any?

        ValidationError.new("No devices are selected for installation")
      end

      # Helper class to generate volumes from volume specs
      class VolumesGenerator
        # Constructor
        #
        # @param specs [Array<Y2Storage::VolumeSpecification>]
        # @param planned_devices [Array<Y2Storage::Planned::Device>]
        def initialize(specs, planned_devices: [])
          @specs = specs
          @planned_devices = planned_devices
        end

        # Generates volumes
        #
        # @param only_proposed [Boolean] Whether to generate volumes only for specs with proposed
        #   equal to true.
        # @return [Array<Volume>]
        def volumes(only_proposed: false)
          specs = self.specs
          specs = specs.select(&:proposed?) if only_proposed
          specs.map { |s| converter.to_dinstaller(s, devices: planned_devices) }
        end

      private

        # Volume specs used for generating volumes
        #
        # @return [Array<Y2Storage::VolumeSpecification>]
        attr_reader :specs

        # Planned devices used for completing some volume settings
        #
        # @return [Array<Y2Storage::Planned::Device>]
        attr_reader :planned_devices

        # Object to perform the conversion of the volumes
        def converter
          @converter ||= VolumeConverter.new(default_specs: specs)
        end
      end
    end
  end
end
