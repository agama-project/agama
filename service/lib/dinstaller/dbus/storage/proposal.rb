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

require "dbus"
require "dinstaller/dbus/base_object"
require "dinstaller/dbus/storage/volume_converter"

module DInstaller
  module DBus
    module Storage
      # D-Bus object to manage the storage proposal
      class Proposal < BaseObject
        PATH = "/org/opensuse/DInstaller/Storage1/Proposal"
        private_constant :PATH

        # Constructor
        #
        # @param backend [DInstaller::Storage::Proposal]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
          register_proposal_callbacks
        end

        STORAGE_PROPOSAL_INTERFACE = "org.opensuse.DInstaller.Storage1.Proposal"
        private_constant :STORAGE_PROPOSAL_INTERFACE

        dbus_interface STORAGE_PROPOSAL_INTERFACE do
          dbus_reader :candidate_devices, "as"

          dbus_reader :lvm, "b", dbus_name: "LVM"

          dbus_reader :encryption_password, "s"

          dbus_reader :volumes, "aa{sv}"

          dbus_reader :actions, "aa{sv}"
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

        # Volumes used to calculate the storage proposal
        #
        # @return [Hash]
        def volumes
          return [] unless backend.calculated_settings

          converter = VolumeConverter.new
          backend.calculated_settings.volumes.map { |v| converter.to_dbus(v) }
        end

        # List of sorted actions in D-Bus format
        #
        # @see #to_dbus_action
        #
        # @return [Array<Hash>]
        def actions
          backend.actions.map { |a| to_dbus_action(a) }
        end

      private

        # @return [DInstaller::Storage::Proposal]
        attr_reader :backend

        # @return [Logger]
        attr_reader :logger

        def register_proposal_callbacks
          backend.on_calculate do
            properties = interfaces_and_properties[STORAGE_PROPOSAL_INTERFACE]
            dbus_properties_changed(STORAGE_PROPOSAL_INTERFACE, properties, [])
          end
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
