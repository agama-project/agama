# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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

require "agama/storage/proposal_settings"
require "agama/dbus/storage/volume_converter"

module Agama
  module DBus
    module Storage
      # Utility class offering methods to convert volumes between D-Installer and D-Bus formats
      #
      # @note In the future this class might be not needed if proposal volumes and templates are
      #   exported as objects in D-Bus.
      class ProposalSettingsConverter
        # Converts the given D-Bus settings to its equivalent D-Installer proposal settings
        #
        # @param dbus_settings [Hash]
        # @return [Agama::Storage::ProposalSettings]
        def to_dinstaller(dbus_settings)
          ToDInstaller.new(dbus_settings).convert
        end

        # Internal class to generate a D-Installer proposal settings
        class ToDInstaller
          # Constructor
          #
          # @param dbus_settings [Hash]
          def initialize(dbus_settings)
            @dbus_settings = dbus_settings
          end

          # Converts settings from D-Bus to D-Installer format
          #
          # @return [Agama::Storage::ProposalSettings]
          def convert
            Agama::Storage::ProposalSettings.new.tap do |proposal_settings|
              dbus_settings.each do |dbus_property, dbus_value|
                setter, value_converter = SETTINGS_CONVERSIONS[dbus_property]
                proposal_settings.public_send(setter, value_converter.call(dbus_value, self))
              end
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_settings

          # Relationship between D-Bus settings and D-Installer proposal settings
          #
          # For each D-Bus setting there is a list with the setter to use and the conversion from a
          # D-Bus value to the value expected by the ProposalSettings setter.
          SETTINGS_CONVERSIONS = {
            "CandidateDevices"   => ["candidate_devices=", proc { |v| v }],
            "LVM"                => ["lvm=", proc { |v| v }],
            "EncryptionPassword" => ["encryption_password=", proc { |v| v.empty? ? nil : v }],
            "Volumes"            => ["volumes=", proc { |v, o| o.send(:to_dinstaller_volumes, v) }]
          }.freeze
          private_constant :SETTINGS_CONVERSIONS

          # Converts volumes from D-Bus to the D-Installer format
          #
          # @param dbus_volumes [Array<Hash>]
          # @return [Array<Agama::Storage::Volume>]
          def to_dinstaller_volumes(dbus_volumes)
            converter = VolumeConverter.new
            dbus_volumes.map { |v| converter.to_dinstaller(v) }
          end
        end
      end
    end
  end
end
