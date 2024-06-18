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
      # D-Bus object to manage the storage proposal.
      class Proposal < BaseObject
        PATH = "/org/opensuse/Agama/Storage1/Proposal"
        private_constant :PATH

        # @param backend [Agama::Storage::Proposal]
        # @param logger [Logger]
        def initialize(backend, logger)
          super(PATH, logger: logger)
          @backend = backend
        end

        STORAGE_PROPOSAL_INTERFACE = "org.opensuse.Agama.Storage1.Proposal"
        private_constant :STORAGE_PROPOSAL_INTERFACE

        dbus_interface STORAGE_PROPOSAL_INTERFACE do
          dbus_reader :settings, "a{sv}"
          dbus_reader :actions, "aa{sv}"
        end

        # Proposal settings.
        #
        # @see ProposalSettingsConversion::ToDBus
        #
        # @return [Hash]
        def settings
          return {} unless backend.settings

          ProposalSettingsConversion.to_dbus(backend.settings)
        end

        # List of sorted actions in D-Bus format.
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

        # Converts an action to D-Bus format.
        #
        # @param action [Y2Storage::CompoundAction]
        # @return [Hash<String, Object>]
        #   * "Device" [Integer]
        #   * "Text" [String]
        #   * "Subvol" [Boolean]
        #   * "Delete" [Boolean]
        #   * "Resize" [Boolean]
        def to_dbus_action(action)
          {
            "Device" => action.device.sid,
            "Text"   => action.text,
            "Subvol" => action.on_btrfs_subvolume?,
            "Delete" => action.delete?,
            "Resize" => action.resize?
          }
        end
      end
    end
  end
end
