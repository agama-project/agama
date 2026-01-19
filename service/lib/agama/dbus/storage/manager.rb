# frozen_string_literal: true

# Copyright (c) [2022-2025] SUSE LLC
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
require "agama/storage/config_conversions"
require "agama/storage/encryption_settings"
require "agama/storage/volume_templates_builder"
require "agama/storage/devicegraph_conversions"
require "agama/storage/volume_conversions"
require "agama/with_progress"
require "dbus"
require "json"
require "yast"

Yast.import "Arch"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage storage installation
      class Manager < BaseObject
        extend Yast::I18n
        include Yast::I18n
        include Agama::WithProgress

        PATH = "/org/opensuse/Agama/Storage1"
        private_constant :PATH

        # @param backend [Agama::Storage::Manager]
        # @param logger [Logger, nil]
        def initialize(backend, logger: nil)
          textdomain "agama"
          super(PATH, logger: logger)
          @backend = backend
          register_progress_callbacks
          add_s390_interfaces if Yast::Arch.s390
        end

        dbus_interface "org.opensuse.Agama.Storage1" do
          dbus_method(:Activate) { activate }
          dbus_method(:Probe) { probe }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
          dbus_method(:SetLocale, "in locale:s") { |locale| backend.configure_locale(locale) }
          dbus_method(:GetSystem, "out system:s") { recover_system }
          dbus_method(:GetConfig, "out config:s") { recover_config }
          dbus_method(:SetConfig, "in product:s, in config:s") { |p, c| configure(p, c) }
          dbus_method(:GetConfigModel, "out model:s") { recover_config_model }
          dbus_method(:SetConfigModel, "in model:s") { |m| configure_with_model(m) }
          dbus_method(:SolveConfigModel, "in model:s, out result:s") { |m| solve_config_model(m) }
          dbus_method(:GetProposal, "out proposal:s") { recover_proposal }
          dbus_method(:GetIssues, "out issues:s") { recover_issues }
          dbus_signal(:SystemChanged, "system:s")
          dbus_signal(:ProposalChanged, "proposal:s")
          dbus_signal(:ProgressChanged, "progress:s")
          dbus_signal(:ProgressFinished)
        end

        # Implementation for the API method #Activate.
        def activate
          start_progress(3, ACTIVATING_STEP)
          backend.reset_activation if backend.activated?
          backend.activate

          next_progress_step(PROBING_STEP)
          backend.probe
          emit_system_changed

          next_progress_step(CONFIGURING_STEP)
          configure_with_current

          finish_progress
        end

        # Implementation for the API method #Probe.
        def probe
          start_progress(3, ACTIVATING_STEP)
          backend.activate unless backend.activated?

          next_progress_step(PROBING_STEP)
          backend.probe
          emit_system_changed

          next_progress_step(CONFIGURING_STEP)
          configure_with_current

          finish_progress
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

        # NOTE: memoization of the values?
        # @return [String]
        def recover_system
          return nil.to_json unless backend.probed?

          json = {
            devices:            json_devices(:probed),
            availableDrives:    available_drives,
            availableMdRaids:   available_md_raids,
            candidateDrives:    candidate_drives,
            candidateMdRaids:   candidate_md_raids,
            issues:             system_issues,
            productMountPoints: product_mount_points,
            encryptionMethods:  encryption_methods,
            volumeTemplates:    volume_templates
          }
          JSON.pretty_generate(json)
        end

        # Gets and serializes the storage config used for calculating the current proposal.
        #
        # @return [String]
        def recover_config
          json = proposal.storage_json
          JSON.pretty_generate(json)
        end

        # Gets and serializes the storage config model.
        #
        # @return [String]
        def recover_config_model
          json = proposal.model_json
          JSON.pretty_generate(json)
        end

        # Applies the given serialized config according to the JSON schema.
        #
        # The JSON schema supports two different variants:
        # { "storage": ... } or { "legacyAutoyastStorage": ... }.
        #
        # @raise If the config is not valid.
        #
        # @param serialized_product [String] Serialized product config.
        # @param serialized_config [String] Serialized storage config.
        def configure(serialized_product, serialized_config)
          system_changed = false
          new_product_config = Agama::Config.new(JSON.parse(serialized_product))

          if product_config != new_product_config
            system_changed = true
            backend.product_config = new_product_config
          end

          start_progress(3, ACTIVATING_STEP)
          if !backend.activated?
            backend.activate
            # Potential change in system - issues
            system_changed = true
          end

          next_progress_step(PROBING_STEP)
          if !backend.probed?
            backend.probe
            # Potential change in system - devices, issues, candidateX, availableX
            system_changed = true
          end

          emit_system_changed if system_changed

          next_progress_step(CONFIGURING_STEP)
          config_json = JSON.parse(serialized_config, symbolize_names: true)

          calculate_proposal(config_json)

          finish_progress
        end

        # Applies the given serialized config model according to the JSON schema.
        #
        # @param serialized_model [String] Serialized storage config model.
        def configure_with_model(serialized_model)
          start_progress(1, CONFIGURING_STEP)

          model_json = JSON.parse(serialized_model, symbolize_names: true)
          config = Agama::Storage::ConfigConversions::FromModel.new(
            model_json,
            product_config: product_config,
            storage_system: proposal.storage_system
          ).convert
          config_json = { storage: Agama::Storage::ConfigConversions::ToJSON.new(config).convert }
          calculate_proposal(config_json)

          finish_progress
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

        # NOTE: memoization of the values?
        # @return [String]
        def recover_proposal
          return nil.to_json unless backend.proposal.success?

          json = {
            devices: json_devices(:staging),
            actions: actions
          }
          JSON.pretty_generate(json)
        end

        # Gets and serializes the list of issues.
        #
        # @return [String]
        def recover_issues
          json = backend.issues.map { |i| json_issue(i) }
          JSON.pretty_generate(json)
        end

        dbus_interface "org.opensuse.Agama.Storage1.Bootloader" do
          dbus_method(:SetConfig, "in serialized_config:s, out result:u") do |serialized_config|
            load_bootloader_config_from_json(serialized_config)
          end
          dbus_method(:GetConfig, "out serialized_config:s") do
            bootloader_config_as_json
          end
        end

        # Applies the given serialized config according to the JSON schema.
        #
        #
        # @raise If the config is not valid.
        #
        # @param serialized_config [String] Serialized storage config.
        # @return [Integer] 0 success; 1 error
        def load_bootloader_config_from_json(serialized_config)
          logger.info("Setting bootloader config from D-Bus: #{serialized_config}")

          backend.bootloader.config.load_json(serialized_config)
          # after loading config try to apply it, so proper packages can be requested
          # TODO: generate also new issue from configuration
          backend.bootloader.configure

          0
        end

        # Gets and serializes the storage config used to calculate the current proposal.
        #
        # @return [String] Serialized config according to the JSON schema.
        def bootloader_config_as_json
          backend.bootloader.config.to_json
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
          on_progress_change { self.ProgressChanged(progress.to_json) }
          on_progress_finish { self.ProgressFinished }
        end

        # Configures storage using the current config.
        #
        # @note The proposal is not calculated if there is not a config yet.
        def configure_with_current
          config_json = proposal.storage_json
          return unless config_json

          calculate_proposal(config_json)
        end

        # @see #configure
        # @see #configure_with_model
        #
        # @param config_json [Hash, nil] see Agama::Storage::Manager#configure
        def calculate_proposal(config_json = nil)
          backend.configure(config_json)
          backend.add_packages if backend.proposal.success?

          self.ProposalChanged(recover_proposal)
        end

        # JSON representation of the given devicegraph from StorageManager
        #
        # @param meth [Symbol] method used to get the devicegraph from StorageManager
        # @return [Hash]
        def json_devices(meth)
          devicegraph = Y2Storage::StorageManager.instance.send(meth)
          Agama::Storage::DevicegraphConversions::ToJSON.new(devicegraph).convert
        end

        # JSON representation of the given Agama issue
        #
        # @param issue [Array<Agama::Issue>]
        # @return [Hash]
        def json_issue(issue)
          {
            description: issue.description,
            class:       issue.kind&.to_s,
            details:     issue.details&.to_s
          }.compact
        end

        # List of sorted actions.
        #
        # @return [Hash<Symbol, Object>]
        #   * :device [Integer]
        #   * :text [String]
        #   * :subvol [Boolean]
        #   * :delete [Boolean]
        #   * :resize [Boolean]
        def actions
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

        # Problems found during system probing
        #
        # @see #recover_system
        #
        # @return [Hash]
        def system_issues
          backend.system_issues.map { |i| json_issue(i) }
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

        # Emits the SystemChanged signal
        def emit_system_changed
          self.SystemChanged(recover_system)
        end

        def add_s390_interfaces
          require "agama/dbus/storage/interfaces/dasd_manager"
          require "agama/dbus/storage/interfaces/zfcp_manager"

          singleton_class.include Interfaces::DasdManager
          singleton_class.include Interfaces::ZFCPManager

          register_dasd_callbacks
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
