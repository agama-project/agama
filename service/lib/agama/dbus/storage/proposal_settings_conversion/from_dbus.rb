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
            settings = ProposalSettingsReader.new(config).read

            settings.tap do |target|
              dbus_settings.each do |dbus_property, dbus_value|
                send(CONVERSIONS[dbus_property], target, dbus_value)
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
            "BootDevice"              => :boot_device_conversion,
            "LVM"                     => :lvm_conversion,
            "SystemVGDevices"         => :system_vg_devices_conversion,
            "EncryptionPassword"      => :encryption_password_conversion,
            "EncryptionMethod"        => :encryption_method_conversion,
            "EncryptionPBKDFunction"  => :encryption_pbkd_function_conversion,
            "SpacePolicy"             => :space_policy_conversion,
            "SpaceActions"            => :space_actions_conversion,
            "Volumes"                 => :volumes_conversion
          }.freeze
          private_constant :CONVERSIONS

          def boot_device_conversion(target, value)
            target.boot_device = value
          end

          def lvm_conversion(target, value)
            target.lvm.enabled = value
          end

          def system_vg_devices_conversion(target, value)
            target.lvm.system_vg_devices = value
          end

          def encryption_password_conversion(target, value)
            target.encryption.password = value.empty? ? nil : value
          end

          def encryption_method_conversion(target, value)
            method = Y2Storage::EncryptionMethod.find(value.to_sym)
            return unless method

            target.encryption.method = method
          end

          def encryption_pbkd_function_conversion(target, value)
            function = Y2Storage::PbkdFunction.find(value)
            return unless function

            target.encryption.pbkd_function = function
          end

          def space_policy_conversion(target, value)
            target.space.policy = value.to_sym unless value.empty?
          end

          def space_actions_conversion(target, value)
            target.space.actions = value
          end

          def volumes_conversion(target, value)
            # Keep default volumes if no volumes are given
            return if value.empty?

            required_volumes = target.volumes.select { |v| v.ouline.required? }
            volumes = value.map { |v| VolumeConversion.from_dbus(v, config: config) }

            target.volumes = volumes + missing_volumes(required_volumes, volumes)
          end

          def missing_volumes(required_volumes, volumes)
            mount_paths = volumes.map(&:mount_path)

            required_volumes.reject { |v| mount_paths.include?(v.mount_path) }
          end
        end
      end
    end
  end
end
