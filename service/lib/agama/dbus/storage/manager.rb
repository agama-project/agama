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

require "dbus"
require "json"
require "yast"
require "y2storage/storage_manager"
require "agama/dbus/base_object"
require "agama/dbus/interfaces/issues"
require "agama/dbus/interfaces/locale"
require "agama/dbus/interfaces/progress"
require "agama/dbus/interfaces/service_status"
require "agama/dbus/storage/devices_tree"
require "agama/dbus/storage/iscsi_nodes_tree"
require "agama/dbus/storage/proposal_settings_conversion"
require "agama/dbus/storage/proposal"
require "agama/dbus/storage/volume_conversion"
require "agama/dbus/storage/with_iscsi_auth"
require "agama/dbus/with_service_status"
require "agama/storage/encryption_settings"
require "agama/storage/proposal_settings_conversion"
require "agama/storage/volume_templates_builder"

Yast.import "Arch"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage storage installation
      class Manager < BaseObject # rubocop:disable Metrics/ClassLength
        include WithISCSIAuth
        include WithServiceStatus
        include ::DBus::ObjectManager
        include DBus::Interfaces::Issues
        include DBus::Interfaces::Locale
        include DBus::Interfaces::Progress
        include DBus::Interfaces::ServiceStatus

        PATH = "/org/opensuse/Agama/Storage1"
        private_constant :PATH

        # Constructor
        #
        # @param backend [Agama::Storage::Manager]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
          @encryption_methods = read_encryption_methods
          @actions = read_actions

          register_storage_callbacks
          register_proposal_callbacks
          register_progress_callbacks
          register_service_status_callbacks
          register_iscsi_callbacks
          register_software_callbacks

          add_s390_interfaces if Yast::Arch.s390
        end

        # List of issues, see {DBus::Interfaces::Issues}
        #
        # @return [Array<Agama::Issue>]
        def issues
          backend.issues
        end

        STORAGE_INTERFACE = "org.opensuse.Agama.Storage1"
        private_constant :STORAGE_INTERFACE

        def probe
          busy_while { backend.probe }
        end

        # Sets the storage config and calculates a proposal (guided or AutoYaST).
        #
        # @raise If config is not valid.
        #
        # @param serialized_config [String] Serialized storage config. It can be storage or legacy
        #   AutoYaST settings: { "storage": ... } vs { "legacyAutoyastStorage": ... }.
        def apply_storage_config(serialized_config)
          @serialized_storage_config = serialized_config
          storage_config = JSON.parse(serialized_config, symbolize_names: true)

          if (guided_settings = storage_config.dig(:storage, :guided))
            calculate_guided_proposal(guided_settings)
          elsif (autoyast_settings = storage_config[:legacyAutoyastStorage])
            calculate_autoyast_proposal(autoyast_settings)
          else
            raise "Invalid config: #{serialized_config}"
          end
        end

        # Serialized storage config. It can contain storage or legacy AutoYaST settings:
        # { "storage": ... } vs { "legacyAutoyastStorage": ... }
        #
        # @return [String]
        def serialized_storage_config
          @serialized_storage_config || JSON.pretty_generate(generate_storage_config)
        end

        def install
          busy_while { backend.install }
        end

        def finish
          busy_while { backend.finish }
        end

        # Whether the system is in a deprecated status
        #
        # @return [Boolean]
        def deprecated_system
          backend.deprecated_system?
        end

        dbus_interface STORAGE_INTERFACE do
          dbus_method(:Probe) { probe }
          dbus_method(:SetConfig, "in serialized_config:s, out result:u") do |serialized_config|
            busy_while { apply_storage_config(serialized_config) }
          end
          dbus_method(:GetConfig, "out config:s") { serialized_storage_config }
          dbus_method(:Install) { install }
          dbus_method(:Finish) { finish }
          dbus_reader(:deprecated_system, "b")
        end

        # @todo Move device related properties here, for example, the list of system and staging
        #   devices, dirty, etc.
        STORAGE_DEVICES_INTERFACE = "org.opensuse.Agama.Storage1.Devices"
        private_constant :STORAGE_DEVICES_INTERFACE

        # List of sorted actions.
        #
        # @return [Hash<String, Object>]
        #   * "Device" [Integer]
        #   * "Text" [String]
        #   * "Subvol" [Boolean]
        #   * "Delete" [Boolean]
        #   * "Resize" [Boolean]
        def read_actions
          backend.actions.map do |action|
            {
              "Device" => action.device.sid,
              "Text"   => action.text,
              "Subvol" => action.on_btrfs_subvolume?,
              "Delete" => action.delete?,
              "Resize" => action.resize?
            }
          end
        end

        # A PropertiesChanged signal is emitted (see ::DBus::Object.dbus_reader_attr_accessor).
        def update_actions
          self.actions = read_actions
        end

        dbus_interface STORAGE_DEVICES_INTERFACE do
          # PropertiesChanged signal if a proposal is calculated, see
          # {#register_proposal_callbacks}.
          dbus_reader_attr_accessor :actions, "aa{sv}"
        end

        # @todo Rename as "org.opensuse.Agama.Storage1.Proposal".
        PROPOSAL_CALCULATOR_INTERFACE = "org.opensuse.Agama.Storage1.Proposal.Calculator"
        private_constant :PROPOSAL_CALCULATOR_INTERFACE

        # List of disks available for installation
        #
        # Each device is represented by an array containing the name of the device and the label to
        # represent that device in the UI when further information is needed.
        #
        # @return [Array<::DBus::ObjectPath>]
        def available_devices
          proposal.available_devices.map { |d| system_devices_tree.path_for(d) }
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
        def read_encryption_methods
          Agama::Storage::EncryptionSettings
            .available_methods
            .map { |m| m.id.to_s }
        end

        # Default volume used as template
        #
        # @return [Hash]
        def default_volume(mount_path)
          volume = volume_templates_builder.for(mount_path)
          VolumeConversion.to_dbus(volume)
        end

        module ProposalStrategy
          GUIDED = "guided"
          AUTOYAST = "autoyast"
        end

        # Calculates a guided proposal.
        # @deprecated
        #
        # @param dbus_settings [Hash]
        # @return [Integer] 0 success; 1 error
        def calculate_proposal(dbus_settings)
          settings = ProposalSettingsConversion.from_dbus(dbus_settings,
            config: config, logger: logger)

          logger.info(
            "Calculating guided storage proposal from D-Bus.\n " \
            "D-Bus settings: #{dbus_settings}\n" \
            "Agama settings: #{settings.inspect}"
          )

          success = proposal.calculate_guided(settings)
          success ? 0 : 1
        end

        # Whether a proposal was calculated.
        #
        # @return [Boolean]
        def proposal_calculated?
          proposal.calculated?
        end

        # Proposal result, including information about success, strategy and settings.
        #
        # @return [Hash] Empty if there is no proposal yet.
        def proposal_result
          return {} unless proposal.calculated?

          if proposal.strategy?(ProposalStrategy::GUIDED)
            settings = Agama::Storage::ProposalSettingsConversion.to_schema(proposal.settings)
            {
              "success"  => proposal.success?,
              "strategy" => ProposalStrategy::GUIDED,
              "settings" => settings.to_json
            }
          else
            {
              "success"  => proposal.success?,
              "strategy" => ProposalStrategy::AUTOYAST,
              "settings" => proposal.settings.to_json
            }
          end
        end

        dbus_interface PROPOSAL_CALCULATOR_INTERFACE do
          dbus_reader :available_devices, "ao"

          dbus_reader :product_mount_points, "as"

          # PropertiesChanged signal if software is probed, see {#register_software_callbacks}.
          dbus_reader_attr_accessor :encryption_methods, "as"

          dbus_method :DefaultVolume, "in mount_path:s, out volume:a{sv}" do |mount_path|
            [default_volume(mount_path)]
          end

          # @todo Rename as CalculateGuided
          #
          # result: 0 success; 1 error
          dbus_method(:Calculate, "in settings:a{sv}, out result:u") do |settings|
            busy_while { calculate_proposal(settings) }
          end

          dbus_reader :proposal_calculated?, "b", dbus_name: "Calculated"

          dbus_reader :proposal_result, "a{sv}", dbus_name: "Result"
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
          backend.iscsi.initiator.name = value
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
        #   @option ReversePassword [String] Username for authentication by inititator
        #
        # @return [Integer] 0 on success, 1 on failure
        def iscsi_discover(address, port, options = {})
          success = backend.iscsi.discover_send_targets(address, port, iscsi_auth(options))
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

        def locale=(locale)
          backend.locale = locale
        end

      private

        # @return [Agama::Storage::Manager]
        attr_reader :backend

        # @return [DBus::Storage::Proposal, nil]
        attr_reader :dbus_proposal

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

        # Calculates a guided proposal.
        #
        # @param settings [Hash] Settings according to the JSON schema.
        # @return [Integer] 0 success; 1 error
        def calculate_guided_proposal(settings)
          proposal_settings = Agama::Storage::ProposalSettingsConversion.from_schema(
            settings, config: config
          )

          logger.info(
            "Calculating guided storage proposal from D-Bus.\n" \
            "Input settings: #{settings}\n" \
            "Agama settings: #{proposal_settings.inspect}"
          )

          success = proposal.calculate_guided(proposal_settings)
          success ? 0 : 1
        end

        # Calculates an AutoYaST proposal.
        #
        # @param settings [Hash] AutoYaST settings.
        # @return [Integer] 0 success; 1 error
        def calculate_autoyast_proposal(settings)
          # Ensures keys are strings.
          autoyast_settings = JSON.parse(settings.to_json)

          logger.info(
            "Calculating AutoYaST storage proposal from D-Bus.\n" \
            "Input settings: #{settings}\n" \
            "AutoYaST settings: #{autoyast_settings}"
          )

          success = proposal.calculate_autoyast(autoyast_settings)
          success ? 0 : 1
        end

        # Generates the storage config from the current proposal, if any.
        #
        # @return [Hash] Storage config according to the JSON schema.
        def generate_storage_config
          if proposal.strategy?(ProposalStrategy::GUIDED)
            {
              storage: {
                guided: Agama::Storage::ProposalSettingsConversion.to_schema(proposal.settings)
              }
            }
          elsif proposal.strategy?(ProposalStrategy::AUTOYAST)
            {
              autoyastLegacyStorage: proposal.settings
            }
          else
            {}
          end
        end

        def register_storage_callbacks
          backend.on_issues_change { issues_properties_changed }
          backend.on_deprecated_system_change { storage_properties_changed }
          backend.on_probe { refresh_system_devices }
        end

        def register_proposal_callbacks
          proposal.on_calculate do
            export_proposal
            proposal_properties_changed
            refresh_staging_devices
            update_actions
          end
        end

        def register_iscsi_callbacks
          backend.iscsi.on_activate do
            properties = interfaces_and_properties[ISCSI_INITIATOR_INTERFACE]
            dbus_properties_changed(ISCSI_INITIATOR_INTERFACE, properties, [])
          end

          backend.iscsi.on_probe do
            refresh_iscsi_nodes
          end

          backend.iscsi.on_sessions_change do
            deprecate_system
          end
        end

        def register_software_callbacks
          backend.software.on_probe_finished do
            # A PropertiesChanged signal is emitted (see ::DBus::Object.dbus_reader_attr_accessor).
            self.encryption_methods = read_encryption_methods
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

          return unless proposal.strategy?(ProposalStrategy::GUIDED)

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
        def config
          backend.config
        end

        # @return [Agama::VolumeTemplatesBuilder]
        def volume_templates_builder
          Agama::Storage::VolumeTemplatesBuilder.new_from_config(config)
        end
      end
    end
  end
end
