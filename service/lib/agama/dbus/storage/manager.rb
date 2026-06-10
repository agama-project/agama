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

require "agama/dbus/base_object"
require "agama/dbus/with_issues"
require "agama/dbus/with_progress"
require "agama/dbus/with_resolvables"
require "agama/storage/bootloader"
require "agama/storage/config_conversions"
require "agama/storage/volume_templates_builder"
require "agama/storage/devicegraph_conversions"
require "agama/storage/volume_conversions"
require "dbus"
require "json"
require "yast"
require "y2storage/storage_manager"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage storage installation
      #
      # The class is long due to declarations (D-BUS, JSON and progress reporting).
      class Manager < BaseObject # rubocop:disable Metrics/ClassLength
        extend Yast::I18n
        include Yast::I18n
        include WithIssues
        include WithProgress
        include WithResolvables

        PATH = "/org/opensuse/Agama/Storage1"
        private_constant :PATH

        # @param manager [Agama::Storage::Manager]
        # @param logger [Logger, nil]
        def initialize(manager, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @manager = manager
          @serialized_system = serialize_system
          @serialized_config = serialize_config
          @serialized_config_model = serialize_config_model
          @serialized_proposal = serialize_proposal
          @serialized_issues = serialize_issues
          @serialized_resolvables = serialize_storage_resolvables
          @serialized_bootloader_system = serialize_bootloader_system
          @serialized_bootloader_config = serialize_bootloader_config
          @serialized_bootloader_resolvables = serialize_bootloader_resolvables
          register_progress_callbacks
        end

        dbus_interface "org.opensuse.Agama.Storage1" do
          dbus_reader_attr_accessor :serialized_system, "s", dbus_name: "System"
          dbus_reader_attr_accessor :serialized_config, "s", dbus_name: "Config"
          dbus_reader_attr_accessor :serialized_config_model, "s", dbus_name: "ConfigModel"
          dbus_reader_attr_accessor :serialized_proposal, "s", dbus_name: "Proposal"
          dbus_reader_attr_accessor :serialized_issues, "s", dbus_name: "Issues"
          dbus_reader_attr_accessor :serialized_resolvables, "s", dbus_name: "Resolvables"
          dbus_method(:Activate) { activate }
          dbus_method(:Probe) { probe }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
          dbus_method(:Umount) { umount }
          dbus_method(:SetLocale, "in locale:s") { |locale| manager.configure_locale(locale) }
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
          manager.reset_activation if manager.activated?
          manager.activate

          next_progress_step(PROBING_STEP)
          perform_probe(force: true)

          next_progress_step(CONFIGURING_STEP)
          configure_with_current

          finish_progress
        end

        # Implementation for the API method #Probe.
        def probe
          logger.info("Probing storage")

          start_progress(3, ACTIVATING_STEP)
          manager.activate

          next_progress_step(PROBING_STEP)
          perform_probe(force: true)

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
          return if manager.configured?(product_config_json, config_json)

          logger.info("Configuring storage")

          product_config = Agama::Config.new(product_config_json)
          manager.update_product_config(product_config) if manager.product_config != product_config

          start_progress(3, ACTIVATING_STEP)
          manager.activate unless manager.activated?

          next_progress_step(PROBING_STEP)
          perform_probe

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
            product_config:    product_config,
            bootloader_config: proposal.bootloader_config(solved: true),
            storage_system:    proposal.storage_system
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
          manager.configure_bootloader

          next_progress_step(_("Preparing the storage devices"))
          manager.install

          next_progress_step(_("Writing bootloader sysconfig"))
          manager.install_bootloader

          finish_progress
        end

        # Implementation for the API method #Finish.
        def finish
          start_progress(1, _("Finishing installation"))
          manager.finish
          finish_progress
        end

        # Implementation for the API method #Umount.
        def umount
          start_progress(1, _("Unmounting devices"))
          manager.umount
          finish_progress
        end

        dbus_interface "org.opensuse.Agama.Storage1.Bootloader" do
          dbus_reader_attr_accessor :serialized_bootloader_system, "s", dbus_name: "System"
          dbus_reader_attr_accessor :serialized_bootloader_config, "s", dbus_name: "Config"
          dbus_reader_attr_accessor :serialized_bootloader_resolvables, "s",
            dbus_name: "Resolvables"
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
          config_json = JSON.parse(serialized_config, symbolize_names: true)
          reconfigure_storage = manager.configured_for_bootloader?(config_json)
          manager.update_bootloader_config(config_json)

          # after loading config try to apply it, so proper packages can be requested
          # TODO: generate also new issue from configuration
          if reconfigure_storage
            configure_with_current
          else
            calculate_bootloader
          end
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
        attr_reader :manager

        def register_progress_callbacks
          on_progress_change { self.ProgressChanged(serialize_progress) }
          on_progress_finish { self.ProgressFinished }
        end

        # Probes and updates the associated info.
        #
        # @param force [Boolean] Forces storage reprobe.
        def perform_probe(force: false)
          manager.probe if force || !manager.probed?
          update_serialized_system

          # Reprobing bootloader is not needed because its information does not change.
          manager.probe_bootloader if !manager.bootloader_probed?
          update_serialized_bootloader_system
        end

        # Configures storage using the current config.
        #
        # @note Skips if no proposal has been calculated yet.
        def configure_with_current
          return unless manager.product_config

          calculate_proposal(manager.config_json)
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
          manager.configure(config_json)

          # The "return if unchanged" guard has been removed from the methods below to always
          # emit the corresponding signal.
          #
          # Since signals do not carry payloads yet, the UI cannot update the query cache
          # directly and must refetch after receiving the signal. Without emitting the signal,
          # the related queries are never invalidated and never refetched, leaving the progress
          # overlay blocked indefinitely.
          #
          # The overlay intentionally waits until fresh data arrives before unblocking, since
          # data can take time to appear after progress completes. Dismissing it
          # earlier would cause flickering and leave users able to interact with stale data.
          #
          # It can be reverted (and UI progress adapted accordingly) when signals carry payloads
          # that allow the UI to update the cache directly, removing the need to wait for a
          # refetch as part of progress completion.
          update_serialized_config
          update_serialized_config_model
          update_serialized_proposal
          update_serialized_issues
          update_serialized_resolvables
        end

        # Performs the bootloader configuration applying the current config.
        def calculate_bootloader
          logger.info("Configuring bootloader")
          manager.configure_bootloader
          update_serialized_bootloader_config
          update_serialized_bootloader_resolvables
        end

        # Updates the system info if needed.
        def update_serialized_system
          serialized_system = serialize_system
          # return if self.serialized_system == serialized_system

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_system = serialized_system
          self.SystemChanged(serialized_system)
        end

        # Updates the config info if needed.
        def update_serialized_config
          serialized_config = serialize_config
          # return if self.serialized_config == serialized_config

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_config = serialized_config
        end

        # Updates the config model info if needed.
        def update_serialized_config_model
          serialized_config_model = serialize_config_model
          # return if self.serialized_config_model == serialized_config_model

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_config_model = serialized_config_model
        end

        # Updates the proposal info if needed.
        def update_serialized_proposal
          serialized_proposal = serialize_proposal
          # return if self.serialized_proposal == serialized_proposal

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_proposal = serialized_proposal
          self.ProposalChanged(serialized_proposal)
        end

        # Updates the issues info if needed.
        def update_serialized_issues
          serialized_issues = serialize_issues
          # return if self.serialized_issues == serialized_issues

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_issues = serialized_issues
        end

        # Updates the resolvables info if needed.
        def update_serialized_resolvables
          serialized_resolvables = serialize_storage_resolvables
          # return if self.serialized_resolvables == serialized_resolvables

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_resolvables = serialized_resolvables
        end

        # Updates the bootloader system info if needed.
        def update_serialized_bootloader_system
          serialized_bootloader_system = serialize_bootloader_system
          return if self.serialized_bootloader_system == serialized_bootloader_system

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_bootloader_system = serialized_bootloader_system
        end

        # Updates the bootloader config if needed.
        def update_serialized_bootloader_config
          serialized_bootloader_config = serialize_bootloader_config
          return if self.serialized_bootloader_config == serialized_bootloader_config

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_bootloader_config = serialized_bootloader_config
        end

        # Updates the bootloader resolvables if needed.
        def update_serialized_bootloader_resolvables
          serialized_bootloader_resolvables = serialize_bootloader_resolvables
          return if self.serialized_bootloader_resolvables == serialized_bootloader_resolvables

          # This assignment emits a D-Bus PropertiesChanged.
          self.serialized_bootloader_resolvables = serialized_bootloader_resolvables
        end

        # Generates the serialized JSON of the system.
        #
        # @return [String]
        def serialize_system
          return serialize_nil unless manager.probed?

          json = {
            devices:               devices_json(:probed),
            availableDrives:       available_drives,
            availableMdRaids:      available_md_raids,
            availableVolumeGroups: available_volume_groups,
            candidateDrives:       candidate_drives,
            candidateMdRaids:      candidate_md_raids,
            issues:                system_issues_json,
            productMountPoints:    product_mount_points,
            volumeTemplates:       volume_templates
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
          return serialize_nil unless manager.proposal.success?

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
          super(manager.issues)
        end

        # Generates the serialized JSON of the list of resolvables.
        #
        # @return [String]
        def serialize_storage_resolvables
          serialize_resolvables(packages: manager.packages)
        end

        # Generates the serialized JSON of the bootloader system.
        #
        # @return [String]
        def serialize_bootloader_system
          return serialize_nil unless manager.bootloader_probed?

          json = {
            availableBootloaders: available_bootloaders_json
          }
          JSON.pretty_generate(json)
        end

        # Generates the serialized JSON of the bootloader config.
        #
        # @return [String]
        def serialize_bootloader_config
          JSON.pretty_generate(manager.bootloader_config.to_json)
        end

        # Generates the serialized JSON of the list of bootloader resolvables.
        #
        # @return [String]
        def serialize_bootloader_resolvables
          serialize_resolvables(packages: manager.bootloader_packages)
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
          manager.actions.map do |action|
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
          manager.system_issues.map { |i| issue_json(i) }
        end

        # List of available bootloaders in JSON format.
        #
        # @see #serialize_bootloader_system
        #
        # @return [Array<Hash>]
        def available_bootloaders_json
          manager.available_bootloaders.map { |b| bootloader_json(b) }
        end

        # Bootloader in JSON format.
        #
        # @param bootloader [Agama::Storage::Bootloader]
        # @return [Hash]
        def bootloader_json(bootloader)
          {
            type:           bootloader.type.value,
            encryptionAuth: bootloader_encryption_auth_json(bootloader)
          }
        end

        # Encryption authentication methods according to the values of the JSON schema.
        #
        # @param bootloader [Agama::Storage::Bootloader]
        # @return [Array<String>]
        def bootloader_encryption_auth_json(bootloader)
          auth_methods = []
          auth_methods << "password" if bootloader.password_encryption_auth?
          auth_methods << "tpm" if bootloader.tpm_encryption_auth?
          auth_methods
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

        # @see Storage::System#available_volume_groups
        # @return [Array<Integer>]
        def available_volume_groups
          proposal.storage_system.available_volume_groups.map(&:sid)
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

        # @return [Agama::Storage::Proposal]
        def proposal
          manager.proposal
        end

        # @return [Agama::Config]
        def product_config
          manager.product_config
        end

        # @return [Agama::VolumeTemplatesBuilder]
        def volume_templates_builder
          Agama::Storage::VolumeTemplatesBuilder.new_from_config(product_config)
        end
      end
    end
  end
end
