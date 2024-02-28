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

require "agama/dbus/base_object"
require "agama/dbus/storage/proposal_settings_conversion"
require "dbus"

module Agama
  module DBus
    module Storage
      # D-Bus object to manage the storage proposal
      class Proposal < BaseObject
        PATH = "/org/opensuse/Agama/Storage1/Proposal"
        private_constant :PATH

        # Constructor
        #
        # @param backend [Agama::Storage::Proposal]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
        end

        STORAGE_PROPOSAL_INTERFACE = "org.opensuse.Agama.Storage1.Proposal"
        private_constant :STORAGE_PROPOSAL_INTERFACE

        dbus_interface STORAGE_PROPOSAL_INTERFACE do
          dbus_reader :target_device, "s"

          dbus_reader :boot_device, "s"

          dbus_reader :lvm, "b", dbus_name: "LVM"

          dbus_reader :system_vg_devices, "as", dbus_name: "SystemVGDevices"

          dbus_reader :encryption_password, "s"

          dbus_reader :encryption_method, "s"

          dbus_reader :encryption_pbkd_function, "s", dbus_name: "EncryptionPBKDFunction"

          dbus_reader :space_policy, "s"

          dbus_reader :space_actions, "aa{sv}"

          dbus_reader :volumes, "aa{sv}"

          dbus_reader :actions, "aa{sv}"
        end

        # Device used as target device by the storage proposal
        #
        # @return [String] Empty string if no device has been selected yet.
        def target_device
          dbus_settings.fetch("TargetDevice", "")
        end

        # Device used as boot device by the storage proposal
        #
        # @return [String] Empty string if no device has been selected yet.
        def boot_device
          dbus_settings.fetch("BootDevice", "")
        end

        # Whether the proposal creates logical volumes
        #
        # @return [Boolean]
        def lvm
          dbus_settings.fetch("LVM", false)
        end

        def system_vg_devices
          dbus_settings.fetch("SystemVGDevices", [])
        end

        # Password for encrypting devices
        #
        # @return [String]
        def encryption_password
          dbus_settings.fetch("EncryptionPassword", "")
        end

        # Encryption method
        #
        # @return [String] For the possible values, check Y2Storage::EncryptionMethod.all
        def encryption_method
          dbus_settings.fetch("EncryptionMethod", "")
        end

        # PBKD function
        #
        # @return [String] For the possible values, check Y2Storage::PbkdFunction.all
        def encryption_pbkd_function
          dbus_settings.fetch("EncryptionPBKDFunction", "")
        end

        # Space policy strategy
        #
        # @return [String] For the possible values, check Agama::Storage::SpaceSettings
        def space_policy
          dbus_settings.fetch("SpacePolicy", "")
        end

        # Space actions
        #
        # @return [Array<Hash>]
        def space_actions
          dbus_settings.fetch("SpaceActions", [])
        end

        # Volumes used to calculate the storage proposal
        #
        # @return [Array<Hash>]
        def volumes
          dbus_settings.fetch("Volumes", [])
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

        # @return [Agama::Storage::Proposal]
        attr_reader :backend

        # @return [Logger]
        attr_reader :logger

        # @return [Hash]
        def dbus_settings
          return {} unless backend.settings

          @dbus_settings ||= ProposalSettingsConversion.to_dbus(backend.settings)
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
