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
      # Utility class offering methods to convert volumes between Agama and D-Bus formats
      #
      # @note In the future this class might be not needed if proposal volumes and templates are
      #   exported as objects in D-Bus.
      class ProposalSettingsConverter
        # Converts the given D-Bus settings to its equivalent Agama proposal settings
        #
        # @param dbus_settings [Hash]
        # @return [Agama::Storage::ProposalSettings]
        def from_dbus(dbus_settings, config: nil)
          FromDBus.new(dbus_settings, config: config).convert
        end

        # Internal class to generate a Agama proposal settings
        class FromDBus
          # Constructor
          #
          # @param dbus_settings [Hash]
          def initialize(dbus_settings, config: nil)
            @dbus_settings = dbus_settings
            @config = config
          end

          # Creates settings from D-Bus
          #
          # @return [Agama::Storage::ProposalSettings]
          def convert
            Agama::Storage::ProposalSettings.new.tap do |settings|
              dbus_settings.each do |dbus_property, dbus_value|
                send(CONVERSIONS[dbus_property], settings, dbus_value)
              end
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_settings

          attr_reader :config

          # Relationship between D-Bus settings and Agama proposal settings
          #
          # For each D-Bus setting there is a list with the setter to use and the conversion from a
          # D-Bus value to the value expected by the ProposalSettings setter.
          CONVERSIONS = {
            "BootDevice"             => :boot_device_conversion,
            "LVM"                    => :lvm_conversion,
            "EncryptionPassword"     => :encryption_password_conversion,
            "SpacePolicy"            => :space_policy_conversion,
            "Volumes"                => :volumes_conversion
          }.freeze
          private_constant :CONVERSIONS

          def boot_device_conversion(settings, value)
            settings.boot_device = value
          end

          def lvm_conversion(settings, value)
            settings.lvm.enabled = value
          end

          def encryption_password_conversion(settings, value)
            settings.encryption.encryption_password = value.empty? ? nil : value
          end

          def space_policy_conversion(settings, value)
            settings.space.policy = value.to_sym unless value.empty?
          end

          def volumes_conversion(settings, value)
            converter = VolumeConverter.new
            volumes = value.map { |v| converter.from_dbus(v, config: config) }
            settings.volumes = volumes + missing_volumes(volumes)
          end

          def missing_volumes(volumes)
            return [] unless volume_generator

            mandatory_volumes = volume_generator.mandatory_volumes
            mandatory_volumes.reject { |mv| volumes.any? { |v| v.mount_path == mv.mount_path } }
          end

          def volume_generator
            return nil unless config

            Agama::Storage::VolumeGenerator.new(config)
          end
        end
      end
    end
  end
end
