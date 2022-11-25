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

require "dbus"
require "dinstaller/dbus/base_object"
require "dinstaller/dbus/with_service_status"
require "dinstaller/dbus/interfaces/service_status"
require "dinstaller/storage/proposal_settings"
require "dinstaller/storage/volume"

module DInstaller
  module DBus
    module Storage
      # D-Bus object to manage a storage proposal
      class Proposal < BaseObject
        include WithServiceStatus
        include Interfaces::ServiceStatus

        PATH = "/org/opensuse/DInstaller/Storage/Proposal1"
        private_constant :PATH

        # Constructor
        #
        # @param backend [DInstaller::Storage::Proposal]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend

          register_callbacks
          register_service_status_callbacks
        end

        STORAGE_PROPOSAL_INTERFACE = "org.opensuse.DInstaller.Storage.Proposal1"
        private_constant :STORAGE_PROPOSAL_INTERFACE

        dbus_interface STORAGE_PROPOSAL_INTERFACE do
          dbus_reader :available_devices, "a(ssa{sv})"

          dbus_reader :candidate_devices, "as"

          dbus_reader :lvm, "b", dbus_name: "LVM"

          dbus_reader :encryption_password, "s"

          # @see {#to_dbus_volume}
          dbus_reader :volume_templates, "aa{sv}"

          # @see {#to_dbus_volume}
          dbus_reader :volumes, "aa{sv}"

          dbus_reader :actions, "aa{sv}"

          # result: 0 success; 1 error
          dbus_method :Calculate, "in settings:a{sv}, out result:u" do |settings|
            success = busy_while { calculate(settings) }

            success ? 0 : 1
          end
        end

        # List of disks available for installation
        #
        # Each device is represented by an array containing the name of the device (as expected by
        # {#calculate} for the setting CandidateDevices), the second one is the label to represent
        # that device in the UI when further information is needed.
        #
        # @return [Array<String, String, Hash>]
        def available_devices
          backend.available_devices.map do |dev|
            [dev.name, backend.device_label(dev), {}]
          end
        end

        # Devices used by the storage proposal
        #
        # @return [Array<String>]
        def candidate_devices
          return [] unless backend.calculated_settings

          backend.calculated_settings.candidate_devices
        end

        # Whether the proposal creates logical volumes
        #
        # @return [Boolean]
        def lvm
          return false unless backend.calculated_settings

          backend.calculated_settings.lvm
        end

        # Password for encrypting devices
        #
        # @return [String]
        def encryption_password
          backend.calculated_settings&.encryption_password || ""
        end

        # Volumes used as template for creating a new volume
        #
        # @return [Hash]
        def volume_templates
          backend.volume_templates.map { |v| to_dbus_volume(v) }
        end

        # Volumes used to calculate the storage proposal
        #
        # @return [Hash]
        def volumes
          return [] unless backend.calculated_settings

          backend.calculated_settings.volumes.map { |v| to_dbus_volume(v) }
        end

        # List of sorted actions in D-Bus format
        #
        # @see #to_dbus_action
        #
        # @return [Array<Hash>]
        def actions
          backend.actions.map { |a| to_dbus_action(a) }
        end

        # Calculates a new proposal
        #
        # @param dbus_settings [DInstaller::Storage::ProposalSettings]
        def calculate(dbus_settings)
          backend.calculate(to_proposal_settings(dbus_settings))
        end

      private

        # @return [DInstaller::Storage::Proposal]
        attr_reader :backend

        # @return [Logger]
        attr_reader :logger

        # Registers callback to be called when the proposal is calculated
        def register_callbacks
          backend.on_calculate do
            properties = interfaces_and_properties[STORAGE_PROPOSAL_INTERFACE]
            dbus_properties_changed(STORAGE_PROPOSAL_INTERFACE, properties, [])
          end
        end

        # Relationship between D-Bus settings and ProposalSettings
        #
        # For each D-Bus setting there is a list with the setter to use and the conversion from a
        # D-Bus value to the value expected by the ProposalSettings setter.
        SETTINGS_CONVERSIONS = {
          "CandidateDevices"   => ["candidate_devices=", proc { |v| v }],
          "LVM"                => ["lvm=", proc { |v| v }],
          "EncryptionPassword" => ["encryption_password=", proc { |v| v.empty? ? nil : v }],
          "Volumes"            => ["volumes=", proc { |v, o| o.send(:to_proposal_volumes, v) }]
        }.freeze
        private_constant :SETTINGS_CONVERSIONS

        # Converts settings from D-Bus format to ProposalSettings
        #
        # @param dbus_settings [Hash]
        # @return [DInstaller::Storage::ProposalSettings]
        def to_proposal_settings(dbus_settings)
          DInstaller::Storage::ProposalSettings.new.tap do |proposal_settings|
            dbus_settings.each do |dbus_property, dbus_value|
              setter, value_converter = SETTINGS_CONVERSIONS[dbus_property]
              proposal_settings.public_send(setter, value_converter.call(dbus_value, self))
            end
          end
        end

        # Relationship between D-Bus volumes and Volumes
        #
        # For each D-Bus volume setting there is a list with the setter to use and the conversion
        # from a D-Bus value to the value expected by the Volume setter.
        VOLUME_CONVERSIONS = {
          "MountPoint"      => ["mount_point=", proc { |v| v }],
          "DeviceType"      => ["device_type=", proc { |v| v.to_sym }],
          "Encrypted"       => ["encrypted=", proc { |v| v }],
          "FsType"          => ["fs_type=", proc { |v, o| o.send(:to_fs_type, v) }],
          "MinSize"         => ["min_size=", proc { |v| Y2Storage::DiskSize.new(v) }],
          "MaxSize"         => ["max_size=", proc { |v| Y2Storage::DiskSize.new(v) }],
          "FixedSizeLimits" => ["fixed_size_limits=", proc { |v| v }],
          "Snapshots"       => ["snapshots=", proc { |v| v }]
        }.freeze
        private_constant :VOLUME_CONVERSIONS

        # Converts volumes from D-Bus format to a list of Volumes
        #
        # @param dbus_volumes [Array<Hash>]
        # @return [Array<DInstaller::Storage::Volume>]
        def to_proposal_volumes(dbus_volumes)
          dbus_volumes.map { |v| to_proposal_volume(v) }
        end

        # Converts a volume from D-Bus format to Volume
        #
        # @param dbus_volume [Hash]
        # @return [DInstaller::Storage::Volume]
        def to_proposal_volume(dbus_volume)
          DInstaller::Storage::Volume.new.tap do |volume|
            dbus_volume.each do |dbus_property, dbus_value|
              setter, value_converter = VOLUME_CONVERSIONS[dbus_property]
              volume.public_send(setter, value_converter.call(dbus_value, self))
            end
          end
        end

        # Converts a filesystem type from D-Bus format to a real filesystem type object
        #
        # @param dbus_fs_type [String]
        # @return [Y2Storage::Filesystems::Type]
        def to_fs_type(dbus_fs_type)
          Y2Storage::Filesystems::Type.all.find { |t| t.to_human_string == dbus_fs_type }
        end

        # Converts a Volume to D-Bus format
        #
        # @param volume {DInstaller::Storage::Volume}
        # @return [Hash]
        def to_dbus_volume(volume)
          dbus_volume = {
            "MountPoint"            => volume.mount_point,
            "Optional"              => volume.optional,
            "DeviceType"            => volume.device_type.to_s,
            "Encrypted"             => volume.encrypted,
            "FsTypes"               => volume.fs_types.map(&:to_human_string),
            "FsType"                => volume.fs_type&.to_human_string,
            "MinSize"               => volume.min_size&.to_i,
            "MaxSize"               => volume.max_size&.to_i,
            "FixedSizeLimits"       => volume.fixed_size_limits,
            "AdaptiveSizes"         => volume.adaptive_sizes?,
            "Snapshots"             => volume.snapshots,
            "SnapshotsConfigurable" => volume.snapshots_configurable,
            "SnapshotsAffectSizes"  => volume.snapshots_affect_sizes?,
            "SizeRelevantVolumes"   => volume.size_relevant_volumes
          }

          dbus_volume.compact.reject { |_, v| v.respond_to?(:empty?) && v.empty? }
        end

        # Converts an action to D-Bus format
        #
        # @param action [Y2Storage::CompoundAction]
        # @return [Hash]
        def to_dbus_action(action)
          {
            "Text"   => action.sentence,
            "Subvol" => action.device_is?(:btrfs_subvolume),
            "Delete" => action.delete?
          }
        end
      end
    end
  end
end
