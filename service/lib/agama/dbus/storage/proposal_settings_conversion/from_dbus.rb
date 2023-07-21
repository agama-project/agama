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

require "y2storage/encryption_method"
require "y2storage/pbkd_function"
require "agama/storage/proposal_settings"
require "agama/storage/volume_templates_builder"
require "agama/storage/proposal_settings_reader"
require "agama/dbus/storage/volume_conversion"

module Agama
  module DBus
    module Storage
      module ProposalSettingsConversion
        # Utility class offering methods to convert volumes between Agama and D-Bus formats
        #
        # @note In the future this class might be not needed if proposal volumes and templates are
        #   exported as objects in D-Bus.
        # Internal class to generate a Agama proposal settings
        class FromDBus
          # Constructor
          #
          # @param dbus_settings [Hash]
          def initialize(dbus_settings, config:)
            @dbus_settings = dbus_settings
            @config = config
          end

          # Creates settings from D-Bus
          #
          # @return [Agama::Storage::ProposalSettings]
          def convert
            default_settings.tap do |settings|
              dbus_settings.each do |dbus_property, dbus_value|
                send(CONVERSIONS[dbus_property], settings, dbus_value)
              end
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_settings

          attr_reader :config

          def default_settings
            @default_settings ||= ProposalSettingsReader.new(config).read
          end

          # Relationship between D-Bus settings and Agama proposal settings
          #
          # For each D-Bus setting there is a list with the setter to use and the conversion from a
          # D-Bus value to the value expected by the ProposalSettings setter.
          CONVERSIONS = {
            "BootDevice"              => :boot_device_conversion,
            "LVM"                     => :lvm_conversion,
            "SystemVGDevices"         => :system_vg_devices_conversion,
            "EncryptionPassword"      => :encryption_password_conversion,
            "EncryptionMethod"        => :encryption_method_conversion,
            "EncryptionPBKDFunction"  => :encryption_pbkd_function_conversion,
            "SpacePolicy"             => :space_policy_conversion,
            "Volumes"                 => :volumes_conversion
          }.freeze
          private_constant :CONVERSIONS

          def boot_device_conversion(settings, value)
            settings.boot_device = value
          end

          def lvm_conversion(settings, value)
            settings.lvm.enabled = value
          end

          def system_vg_devices_conversion(settings, value)
            settings.lvm.system_vg_devices = value
          end

          def encryption_password_conversion(settings, value)
            settings.encryption.password = value.empty? ? nil : value
          end

          def encryption_method_conversion(settings, value)
            method = Y2Storage::EncryptionMethod.find(value.to_sym)
            return unless method

            settings.encryption.method = method
          end

          def encryption_pbkd_function_conversion(settings, value)
            function = Y2Storage::PbkdFunction.find(value)
            return unless function

            settings.encryption.pbkd_function = function
          end

          def space_policy_conversion(settings, value)
            settings.space.policy = value.to_sym unless value.empty?
          end

          def volumes_conversion(settings, value)
            # Keep default volumes if no volumes are given
            return if value.empty?

            volumes = value.map { |v| VolumeConversion.from_dbus(v, config: config) }
            settings.volumes = volumes + missing_volumes(volumes)
          end

          def missing_volumes(volumes)
            required_volumes = volume_templates_builder.required_volumes
            mount_paths = volumes.map(&:mount_path)

            required_volumes.reject { |v| mount_paths.include?(v.mount_path) }
          end

          def volume_templates_builder
            @volume_templates_builder ||= VolumeTemplatesBuilder.new_from_config(config)
          end
        end
      end
    end
  end
end
