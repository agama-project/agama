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

require "dbus"
require "json"
require "yast"
require "y2storage/storage_manager"
require "agama/dbus/base_object"
require "agama/dbus/interfaces/issues"
require "agama/dbus/interfaces/locale"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/storage/devices_tree"
require "agama/dbus/storage/iscsi_nodes_tree"
require "agama/dbus/storage/proposal"
require "agama/dbus/storage/proposal_settings_conversion"
require "agama/dbus/with_service_status"
require "agama/storage/config_conversions"
require "agama/storage/encryption_settings"
require "agama/storage/proposal_settings"
require "agama/storage/volume_templates_builder"
require "agama/with_progress"
require "agama/storage/devicegraph_conversions"
require "agama/storage/volume_conversions"

Yast.import "Arch"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage storage installation
      class Manager < BaseObject # rubocop:disable Metrics/ClassLength
        extend Yast::I18n

        include WithProgress
        include WithServiceStatus
        include ::DBus::ObjectManager
        include DBus::Interfaces::Issues
        include DBus::Interfaces::Locale
        include DBus::Interfaces::ServiceStatus

        PATH = "/org/opensuse/Agama/Storage1"
        private_constant :PATH

        # @param backend [Agama::Storage::Manager]
        # @param service_status [Agama::DBus::ServiceStatus, nil]
        # @param logger [Logger, nil]
        def initialize(backend, service_status: nil, logger: nil)
          textdomain "agama"

          super(PATH, logger: logger)
          @backend = backend
          @service_status = service_status

          register_storage_callbacks
          register_progress_callbacks
          register_service_status_callbacks
          register_iscsi_callbacks

          add_s390_interfaces if Yast::Arch.s390
        end

        def locale=(locale)
          backend.locale = locale
        end

        # List of issues, see {DBus::Interfaces::Issues}
        #
        # @return [Array<Agama::Issue>]
        def issues
          backend.issues
        end

        STORAGE_INTERFACE = "org.opensuse.Agama.Storage1"
        private_constant :STORAGE_INTERFACE

        # Whether the system is in a deprecated status
        #
        # @return [Boolean]
        def deprecated_system
          backend.deprecated_system?
        end

        # Implementation for the API method #Activate.
        def activate
          start_progress(3, ACTIVATING_STEP)
          backend.reset_activation if backend.activated?
          backend.activate

          next_progress_step(PROBING_STEP)
          backend.probe

          next_progress_step(CONFIGURING_STEP)
          backend.configure_with_current

          finish_progress
        end

        # Implementation for the API method #Probe.
        def probe
          start_progress(3, ACTIVATING_STEP)
          backend.activate unless backend.activated?

          next_progress_step(PROBING_STEP)
          backend.probe

          next_progress_step(CONFIGURING_STEP)
          backend.configure_with_current

          finish_progress
        end

        # Implementation for the API method #SetProduct.
        def configure_product(id)
          backend.product_config.pick_product(id)

          start_progress(3, ACTIVATING_STEP)
          backend.activate unless backend.activated?

          next_progress_step(PROBING_STEP)
          backend.probe unless backend.probed?

          next_progress_step(CONFIGURING_STEP)
          backend.configure

          finish_progress
        end

        # Implementation for the API method #Install.
        def install
          start_progress(4, _("Preparing bootloader proposal"))
          backend.bootloader.configure

          next_progress_step(_("Adding storage-related packages"))
          backend.add_packages

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

        # @todo Drop support for the guided settings.
        #
        # Applies the given serialized config according to the JSON schema.
        #
        # The JSON schema supports two different variants:
        # { "storage": ... } or { "legacyAutoyastStorage": ... }.
        #
        # @raise If the config is not valid.
        #
        # @param serialized_config [String] Serialized storage config.
        # @return [Integer] 0 success; 1 error
        def configure(serialized_config)
          logger.info("Setting storage config from D-Bus: #{serialized_config}")
          config_json = JSON.parse(serialized_config, symbolize_names: true)
          backend.configure(config_json)
        end

        # Applies the given serialized config model according to the JSON schema.
        #
        # @param serialized_model [String] Serialized storage config model.
        # @return [Integer] 0 success; 1 error
        def configure_with_model(serialized_model)
          logger.info("Setting storage config model from D-Bus: #{serialized_model}")

          model_json = JSON.parse(serialized_model, symbolize_names: true)
          config = Agama::Storage::ConfigConversions::FromModel.new(
            model_json,
            product_config: product_config,
            storage_system: proposal.storage_system
          ).convert
          config_json = { storage: Agama::Storage::ConfigConversions::ToJSON.new(config).convert }

          backend.configure(config_json)
        end

        # Solves the given serialized config model.
        #
        # @param serialized_model [String] Serialized storage config model.
        # @return [String] Serialized solved model.
        def solve_config_model(serialized_model)
          logger.info("Solving storage config model from D-Bus: #{serialized_model}")

          model_json = JSON.parse(serialized_model, symbolize_names: true)
          solved_model_json = proposal.solve_model(model_json)
          JSON.pretty_generate(solved_model_json)
        end

        dbus_interface STORAGE_INTERFACE do
          dbus_method(:Activate) { activate }
          dbus_method(:Probe) { probe }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
          dbus_method(:SetLocale, "in locale:s") {}
          # TODO: receive a product_config instead of an id.
          dbus_method(:SetProduct, "in id:s") { |id| configure_product(id) }
          dbus_method(:GetSystem, "out system:s") { recover_system }
          dbus_method(:GetConfig, "out config:s") { recover_config }
          dbus_method(:SetConfig, "in config:s") { |c| configure(c) }
          dbus_method(:GetConfigModel, "out model:s") { recover_config_model }
          dbus_method(:SetConfigModel, "in model:s") { |m| configure_with_model(m)}
          dbus_method(:SolveConfigModel, "in model:s, out result:s") { |m| solve_config_model(m) }
          dbus_method(:GetProposal, "out proposal:s") { recover_proposal }
          dbus_method(:GetIssues, "out issues:s") {}
          dbus_method(:GetProgress, "out progress:s") { progress.to_json }
          dbus_signal(:SystemChanged)
          dbus_signal(:ConfigChanged)
          dbus_signal(:ProposalChanged)
          dbus_signal(:IssuesChanged)
          dbus_signal(:ProgressChanged, "progress:s")
          dbus_signal(:ProgressFinished)
        end

        BOOTLOADER_INTERFACE = "org.opensuse.Agama.Storage1.Bootloader"
        private_constant :BOOTLOADER_INTERFACE

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

          0
        end

        # Gets and serializes the storage config used to calculate the current proposal.
        #
        # @return [String] Serialized config according to the JSON schema.
        def bootloader_config_as_json
          backend.bootloader.config.to_json
        end

        dbus_interface BOOTLOADER_INTERFACE do
          dbus_method(:SetConfig, "in serialized_config:s, out result:u") do |serialized_config|
            load_bootloader_config_from_json(serialized_config)
          end
          dbus_method(:GetConfig, "out serialized_config:s") do
            bootloader_config_as_json
          end
        end

        # @todo Move device related properties here, for example, the list of system and staging
        #   devices, dirty, etc.
        STORAGE_DEVICES_INTERFACE = "org.opensuse.Agama.Storage1.Devices"
        private_constant :STORAGE_DEVICES_INTERFACE

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

        PROPOSAL_CALCULATOR_INTERFACE = "org.opensuse.Agama.Storage1.Proposal.Calculator"
        private_constant :PROPOSAL_CALCULATOR_INTERFACE

        # Calculates a guided proposal.
        #
        # @param settings_dbus [Hash]
        # @return [Integer] 0 success; 1 error
        def calculate_guided_proposal(settings_dbus)
          logger.info("Calculating guided storage proposal from D-Bus: #{settings_dbus}")

          settings = ProposalSettingsConversion.from_dbus(settings_dbus,
            config: product_config, logger: logger)

          proposal.calculate_guided(settings)
          proposal.success? ? 0 : 1
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

        # NOTE: memoization of the values?
        def recover_proposal
          json = {
            devices: json_devices(:staging),
            actions: actions
          }
          JSON.pretty_generate(json)
        end

        # NOTE: memoization of the values?
        def recover_system
          json = {
            devices:            json_devices(:probed),
            availableDrives:    available_drives,
            availableMdRaids:   available_md_raids,
            candidateDrives:    candidate_drives,
            candidateMdRaids:   candidate_md_raids,
            productMountPoints: product_mount_points,
            encryptionMethods:  encryption_methods,
            volumeTemplates:    volume_templates
          }
          JSON.pretty_generate(json)
        end

        ISCSI_INITIATOR_INTERFACE = "org.opensuse.Agama.Storage1.ISCSI.Initiator"
        private_constant :ISCSI_INITIATOR_INTERFACE

        # Gets the iSCSI initiator name
        #
        # @return [String]
        def initiator_name
          backend.iscsi.initiator.name || ""
        end

        # Sets the iSCSI initiator name
        #
        # @param value [String]
        def initiator_name=(value)
          backend.iscsi.update_initiator(name: value)
        end

        # Whether the initiator name was set via iBFT
        #
        # @return [Boolean]
        def ibft
          backend.iscsi.initiator.ibft_name?
        end

        # Performs an iSCSI discovery
        #
        # @param address [String] IP address of the iSCSI server
        # @param port [Integer] Port of the iSCSI server
        # @param options [Hash<String, String>] Options from a D-Bus call:
        #   @option Username [String] Username for authentication by target
        #   @option Password [String] Password for authentication by target
        #   @option ReverseUsername [String] Username for authentication by initiator
        #   @option ReversePassword [String] Password for authentication by inititator
        #
        # @return [Integer] 0 on success, 1 on failure
        def iscsi_discover(address, port, options = {})
          credentials = {
            username:           options["Username"],
            password:           options["Password"],
            initiator_username: options["ReverseUsername"],
            initiator_password: options["ReversePassword"]
          }

          success = backend.iscsi.discover(address, port, credentials: credentials)
          success ? 0 : 1
        end

        # Deletes an iSCSI node from the database
        #
        # @param path [::DBus::ObjectPath]
        # @return [Integer] 0 on success, 1 on failure if the given node is not exported, 2 on
        #   failure because any other reason.
        def iscsi_delete(path)
          dbus_node = iscsi_nodes_tree.find(path)
          if !dbus_node
            logger.info("iSCSI delete error: iSCSI node #{path} is not exported")
            return 1
          end

          success = backend.iscsi.delete(dbus_node.iscsi_node)
          return 0 if success

          logger.info("iSCSI delete error: fail to delete iSCSI node #{path}")
          2 # Error code
        end

        dbus_interface ISCSI_INITIATOR_INTERFACE do
          dbus_accessor :initiator_name, "s"

          dbus_reader :ibft, "b", dbus_name: "IBFT"

          dbus_method :Discover,
            "in address:s, in port:u, in options:a{sv}, out result:u" do |address, port, options|
            busy_while { iscsi_discover(address, port, options) }
          end

          dbus_method(:Delete, "in node:o, out result:u") { |n| iscsi_delete(n) }
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

        # @return [DBus::Storage::Proposal, nil]
        attr_reader :dbus_proposal

        def register_progress_callbacks
          on_progress_change { self.ProgressChanged(progress.to_json) }
          on_progress_finish { self.ProgressFinished }
        end

        # JSON representation of the given devicegraph from StorageManager
        #
        # @param meth [Symbol] method used to get the devicegraph from StorageManager
        # @return [Hash]
        def json_devices(meth)
          devicegraph = Y2Storage::StorageManager.instance.send(meth)
          Agama::Storage::DevicegraphConversions::ToJSON.new(devicegraph).convert
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

        def register_storage_callbacks
          backend.on_issues_change { issues_properties_changed }
          backend.on_deprecated_system_change { storage_properties_changed }
          backend.on_probe { refresh_system_devices }
          backend.on_configure do
            export_proposal
            proposal_properties_changed
            refresh_staging_devices
          end
        end

        def register_iscsi_callbacks
          backend.iscsi.on_probe do
            iscsi_initiator_properties_changed
            refresh_iscsi_nodes
          end

          backend.iscsi.on_sessions_change do
            # Currently, the system is set as deprecated instead of reprobing automatically. This
            # is done so to avoid a reprobing after each single session change performed by the UI.
            # Clients are expected to request a reprobing if they detect a deprecated system.
            #
            # If the UI is adapted to use the new iSCSI API (i.e., #SetConfig), then this behaviour
            # should be reevaluated. Ideally, the system would be reprobed if the sessions change.
            deprecate_system
          end
        end

        def storage_properties_changed
          properties = interfaces_and_properties[STORAGE_INTERFACE]
          dbus_properties_changed(STORAGE_INTERFACE, properties, [])
        end

        def proposal_properties_changed
          properties = interfaces_and_properties[PROPOSAL_CALCULATOR_INTERFACE]
          dbus_properties_changed(PROPOSAL_CALCULATOR_INTERFACE, properties, [])
        end

        def iscsi_initiator_properties_changed
          properties = interfaces_and_properties[ISCSI_INITIATOR_INTERFACE]
          dbus_properties_changed(ISCSI_INITIATOR_INTERFACE, properties, [])
        end

        def deprecate_system
          backend.deprecated_system = true
        end

        # @todo Do not export a separate proposal object. For now, the guided proposal is still
        #   exported to keep the current UI working.
        def export_proposal
          if dbus_proposal
            @service.unexport(dbus_proposal)
            @dbus_proposal = nil
          end

          return unless proposal.guided?

          @dbus_proposal = DBus::Storage::Proposal.new(proposal, logger)
          @service.export(@dbus_proposal)
        end

        def refresh_system_devices
          devicegraph = Y2Storage::StorageManager.instance.probed
          system_devices_tree.update(devicegraph)
        end

        def refresh_staging_devices
          devicegraph = Y2Storage::StorageManager.instance.staging
          staging_devices_tree.update(devicegraph)
        end

        def refresh_iscsi_nodes
          nodes = backend.iscsi.nodes
          iscsi_nodes_tree.update(nodes)
        end

        def iscsi_nodes_tree
          @iscsi_nodes_tree ||= ISCSINodesTree.new(@service, backend.iscsi, logger: logger)
        end

        # FIXME: D-Bus trees should not be created by the Manager D-Bus object. Note that the
        #   service (`@service`) is nil until the Manager object is exported. The service should
        #   have the responsibility of creating the trees and pass them to Manager if needed.
        def system_devices_tree
          @system_devices_tree ||= DevicesTree.new(@service, tree_path("system"), logger: logger)
        end

        def staging_devices_tree
          @staging_devices_tree ||= DevicesTree.new(@service, tree_path("staging"), logger: logger)
        end

        def tree_path(tree_root)
          File.join(PATH, tree_root)
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
