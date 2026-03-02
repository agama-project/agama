# frozen_string_literal: true

# Copyright (c) [2022-2026] SUSE LLC
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

require "y2storage/storage_manager"
require "agama/dbus/base_object"
require "agama/dbus/with_issues"
require "agama/dbus/with_progress"
require "agama/storage/config_conversions"
require "agama/storage/encryption_settings"
require "agama/storage/volume_templates_builder"
require "agama/storage/devicegraph_conversions"
require "agama/storage/volume_conversions"
require "dbus"
require "json"
require "yast"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage storage installation
      class Manager < BaseObject
        extend Yast::I18n
        include Yast::I18n
        include WithIssues
        include WithProgress

        PATH = "/org/opensuse/Agama/Storage1"
        private_constant :PATH

        # @param backend [Agama::Storage::Manager]
        # @param logger [Logger, nil]
        def initialize(backend, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @backend = backend
          @serialized_system = serialize_system
          @serialized_config = serialize_config
          @serialized_config_model = serialize_config_model
          @serialized_proposal = serialize_proposal
          @serialized_issues = serialize_issues
          @serialized_bootloader_config = serialize_bootloader_config
          register_progress_callbacks
          add_s390_interfaces if Yast::Arch.s390
        end

        dbus_interface "org.opensuse.Agama.Storage1" do
          dbus_reader_attr_accessor :serialized_system, "s", dbus_name: "System"
          dbus_reader_attr_accessor :serialized_config, "s", dbus_name: "Config"
          dbus_reader_attr_accessor :serialized_config_model, "s", dbus_name: "ConfigModel"
          dbus_reader_attr_accessor :serialized_proposal, "s", dbus_name: "Proposal"
          dbus_reader_attr_accessor :serialized_issues, "s", dbus_name: "Issues"
          dbus_method(:Activate) { activate }
          dbus_method(:Probe) { probe }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
          dbus_method(:Umount) { umount }
          dbus_method(:SetLocale, "in locale:s") { |locale| backend.configure_locale(locale) }
          dbus_method(
            :SetConfig, "in serialized_product_config:s, in serialized_config:s"
          ) { |p, c| configure(p, c) }
          dbus_method(
            :GetConfigFromModel, "in serialized_model:s, out result:s"
          ) { |m| convert_config_model(m) }
          dbus_method(
            :SolveConfigModel, "in serialized_model:s, out result:s"
          ) { |m| solve_config_model(m) }
          dbus_signal(:SystemChanged, "serialized_system:s")
          dbus_signal(:ProposalChanged, "serialized_proposal:s")
          dbus_signal(:ProgressChanged, "serialized_progress:s")
          dbus_signal(:ProgressFinished)
        end

        # Implementation for the API method #Activate.
        def activate
          logger.info("Activating storage")

          start_progress(3, ACTIVATING_STEP)
          backend.reset_activation if backend.activated?
          backend.activate

          next_progress_step(PROBING_STEP)
          perform_probe

          next_progress_step(CONFIGURING_STEP)
          configure_with_current

          finish_progress
        end

        # Implementation for the API method #Probe.
        def probe
          logger.info("Probing storage")

          start_progress(3, ACTIVATING_STEP)
          backend.activate unless backend.activated?

          next_progress_step(PROBING_STEP)
          perform_probe

          next_progress_step(CONFIGURING_STEP)
          configure_with_current

          finish_progress
        end

        # Configures storage.
        #
        # The JSON schema supports two different variants:
        # { "storage": ... } or { "legacyAutoyastStorage": ... }.
        #
        # @raise If the config is not valid.
        #
        # @param serialized_product_config [String] Serialized product config.
        # @param serialized_config [String] Serialized storage config.
        def configure(serialized_product_config, serialized_config)
          product_config_json = JSON.parse(serialized_product_config)
          config_json = JSON.parse(serialized_config, symbolize_names: true)

          # Do not configure if there is nothing to change.
          return if backend.configured?(product_config_json, config_json)

          logger.info("Configuring storage")
          product_config = Agama::Config.new(product_config_json)
          backend.update_product_config(product_config) if backend.product_config != product_config

          start_progress(3, ACTIVATING_STEP)
          backend.activate unless backend.activated?

          next_progress_step(PROBING_STEP)
          backend.probe unless backend.probed?

          update_serialized_system

          next_progress_step(CONFIGURING_STEP)
          calculate_proposal(config_json)

          finish_progress
        end

        # Converts the given serialized config model to a config.
        #
        # @param serialized_model [String] Serialized config model.
        # @return [String] Serialized config according to JSON schema.
        def convert_config_model(serialized_model)
          model_json = JSON.parse(serialized_model, symbolize_names: true)

          config = Agama::Storage::ConfigConversions::FromModel.new(
            model_json,
            product_config: product_config,
            storage_system: proposal.storage_system
          ).convert

          config_json = { storage: Agama::Storage::ConfigConversions::ToJSON.new(config).convert }
          JSON.pretty_generate(config_json)
        end

        # Solves the given serialized config model.
        #
        # @param serialized_model [String] Serialized storage config model.
        # @return [String] Serialized solved model.
        def solve_config_model(serialized_model)
          model_json = JSON.parse(serialized_model, symbolize_names: true)
          solved_model_json = proposal.solve_model(model_json)
          JSON.pretty_generate(solved_model_json)
        end

        # Implementation for the API method #Install.
        def install
          start_progress(3, _("Preparing bootloader proposal"))
          backend.bootloader.configure

          next_progress_step(_("Preparing the storage devices"))
          backend.install

          next_progress_step(_("Writing bootloader sysconfig"))
          backend.bootloader.install

          finish_progress
        end

        # Implementation for the API method #Finish.
        def finish
          start_progress(1, _("Finishing installation"))
          backend.finish
          finish_progress
        end

        # Implementation for the API method #Umount.
        def umount
          start_progress(1, _("Unmounting devices"))
          backend.umount
          finish_progress
        end

        dbus_interface "org.opensuse.Agama.Storage1.Bootloader" do
          dbus_reader_attr_accessor :serialized_bootloader_config, "s", dbus_name: "Config"
          dbus_method(:SetConfig, "in serialized_config:s, out result:u") do |serialized_config|
            configure_bootloader(serialized_config)
          end
        end

        # Applies the given serialized config according to the JSON schema.
        #
        # @raise If the config is not valid.
        #
        # @param serialized_config [String] Serialized bootloader config.
        # @return [Integer] 0 success; 1 error
        def configure_bootloader(serialized_config)
          logger.info("Setting bootloader config: #{serialized_config}")
          backend.bootloader.config.load_json(serialized_config)
          # after loading config try to apply it, so proper packages can be requested
          # TODO: generate also new issue from configuration
          calculate_bootloader
          0
        end

      private

        ACTIVATING_STEP = N_("Activating storage devices")
        private_constant :ACTIVATING_STEP

        PROBING_STEP = N_("Probing storage devices")
        private_constant :PROBING_STEP

        CONFIGURING_STEP = N_("Applying storage configuration")
        private_constant :CONFIGURING_STEP

        # @return [Agama::Storage::Manager]
        attr_reader :backend

        def register_progress_callbacks
          on_progress_change { self.ProgressChanged(serialize_progress) }
          on_progress_finish { self.ProgressFinished }
        end

        # Probes storage and updates the associated info.
        #
        # @see #update_system_info
        def perform_probe
          backend.probe
          update_serialized_system
        end

        # Configures storage using the current config.
        #
        # @note Skips if no proposal has been calculated yet.
        def configure_with_current
          return unless proposal.storage_json

          calculate_proposal(backend.config_json)
          # The storage proposal with the current settings is not explicitly requested. It is
          # automatically calculated as side effect of calling to probe or activate. All the
          # dependant steps has to be automatically done too, for example, reconfiguring bootloader.
          calculate_bootloader
        end

        # Calculates a proposal with the given config and updates the associated info.
        #
        # @see #configure and #configure_with_current
        #
        # @param config_json [Hash, nil]
        def calculate_proposal(config_json = nil)
          backend.configure(config_json)
          backend.add_packages if backend.proposal.success?

          update_serialized_config
          update_serialized_config_model
          update_serialized_proposal
          update_serialized_issues
        end

        # Performs the bootloader configuration applying the current config.
        def calculate_bootloader
          logger.info("Configuring bootloader")
          backend.bootloader.configure
          update_serialized_bootloader_config
        end

        # Updates the system info if needed.
        def update_serialized_system
          serialized_system = serialize_system
          return if self.serialized_system == serialized_system

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_system = serialized_system
          self.SystemChanged(serialized_system)
        end

        # Updates the config info if needed.
        def update_serialized_config
          serialized_config = serialize_config
          return if self.serialized_config == serialized_config

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_config = serialized_config
        end

        # Updates the config model info if needed.
        def update_serialized_config_model
          serialized_config_model = serialize_config_model
          return if self.serialized_config_model == serialized_config_model

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_config_model = serialized_config_model
        end

        # Updates the proposal info if needed.
        def update_serialized_proposal
          serialized_proposal = serialize_proposal
          return if self.serialized_proposal == serialized_proposal

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_proposal = serialized_proposal
          self.ProposalChanged(serialized_proposal)
        end

        # Updates the issues info if needed.
        def update_serialized_issues
          serialized_issues = serialize_issues
          return if self.serialized_issues == serialized_issues

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_issues = serialized_issues
        end

        # Updates the bootloader config if needed.
        def update_serialized_bootloader_config
          serialized_bootloader_config = serialize_bootloader_config
          return if self.serialized_bootloader_config == serialized_bootloader_config

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_bootloader_config = serialized_bootloader_config
        end

        # Generates the serialized JSON of the system.
        #
        # @return [String]
        def serialize_system
          return serialize_nil unless backend.probed?

          json = {
            devices:            devices_json(:probed),
            availableDrives:    available_drives,
            availableMdRaids:   available_md_raids,
            candidateDrives:    candidate_drives,
            candidateMdRaids:   candidate_md_raids,
            issues:             system_issues_json,
            productMountPoints: product_mount_points,
            encryptionMethods:  encryption_methods,
            volumeTemplates:    volume_templates
          }
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the storage config used for calculating the current
        # proposal.
        #
        # @return [String]
        def serialize_config
          json = proposal.storage_json
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the storage config model.
        #
        # @return [String]
        def serialize_config_model
          json = proposal.model_json
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the proposal.
        #
        # @return [String]
        def serialize_proposal
          return serialize_nil unless backend.proposal.success?

          json = {
            devices: devices_json(:staging),
            actions: actions_json
          }
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the list of issues.
        #
        # @return [String]
        def serialize_issues
          super(backend.issues)
        end

        # Generates the serialized JSON of the bootloader config.
        #
        # @return [String]
        def serialize_bootloader_config
          backend.bootloader.config.to_json
        end

        # Representation of the null JSON.
        #
        # @return [String]
        def serialize_nil
          nil.to_json
        end

        # Hash representation of the given devicegraph from StorageManager.
        #
        # @param meth [Symbol] method used to get the devicegraph from StorageManager
        # @return [Hash]
        def devices_json(meth)
          devicegraph = Y2Storage::StorageManager.instance.send(meth)
          Agama::Storage::DevicegraphConversions::ToJSON.new(devicegraph).convert
        end

        # List of hash representation of the actions.
        #
        # @return [Array<Hash>]
        #   * :device [Integer]
        #   * :text [String]
        #   * :subvol [Boolean]
        #   * :delete [Boolean]
        #   * :resize [Boolean]
        def actions_json
          backend.actions.map do |action|
            {
              device: action.device_sid,
              text:   action.text,
              subvol: action.on_btrfs_subvolume?,
              delete: action.delete?,
              resize: action.resize?
            }
          end
        end

        # List of hash representation of the problems found during system probing.
        #
        # @see #serialize_system
        #
        # @return [Array<Hash>]
        def system_issues_json
          backend.system_issues.map { |i| issue_json(i) }
        end

        # @see Storage::System#available_drives
        # @return [Array<Integer>]
        def available_drives
          proposal.storage_system.available_drives.map(&:sid)
        end

        # @see Storage::System#available_drives
        # @return [Array<Integer>]
        def candidate_drives
          proposal.storage_system.candidate_drives.map(&:sid)
        end

        # @see Storage::System#available_drives
        # @return [Array<Integer>]
        def available_md_raids
          proposal.storage_system.available_md_raids.map(&:sid)
        end

        # @see Storage::System#available_drives
        # @return [Array<Integer>]
        def candidate_md_raids
          proposal.storage_system.candidate_md_raids.map(&:sid)
        end

        # Meaningful mount points for the current product.
        #
        # @return [Array<String>]
        def product_mount_points
          volume_templates_builder
            .all
            .map(&:mount_path)
            .reject(&:empty?)
        end

        # Reads the list of possible encryption methods for the current system and product.
        #
        # @return [Array<String>]
        def encryption_methods
          Agama::Storage::EncryptionSettings
            .available_methods
            .map { |m| m.id.to_s }
        end

        # Default volumes to be used as templates
        #
        # @return [Array<Hash>]
        def volume_templates
          volumes = volume_templates_builder.all
          volumes << volume_templates_builder.for("") unless volumes.map(&:mount_path).include?("")

          volumes.map do |vol|
            Agama::Storage::VolumeConversions::ToJSON.new(vol).convert
          end
        end

        def add_s390_interfaces
          require "agama/dbus/storage/interfaces/zfcp_manager"
          singleton_class.include Interfaces::ZFCPManager
          register_zfcp_callbacks
        end

        # @return [Agama::Storage::Proposal]
        def proposal
          backend.proposal
        end

        # @return [Agama::Config]
        def product_config
          backend.product_config
        end

        # @return [Agama::VolumeTemplatesBuilder]
        def volume_templates_builder
          Agama::Storage::VolumeTemplatesBuilder.new_from_config(product_config)
        end
      end
    end
  end
end
