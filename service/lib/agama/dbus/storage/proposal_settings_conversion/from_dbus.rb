# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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
require "agama/storage/space_settings"
require "agama/dbus/storage/volume_conversion"

module Agama
  module DBus
    module Storage
      module ProposalSettingsConversion
        # Proposal settings conversion from D-Bus format.
        class FromDBus
          # @param dbus_settings [Hash]
          # @param config [Agama::Config]
          def initialize(dbus_settings, config:)
            @dbus_settings = dbus_settings
            @config = config
          end

          # Performs the conversion from D-Bus format.
          #
          # @return [Agama::Storage::ProposalSettings]
          def convert
            settings = Agama::Storage::ProposalSettingsReader.new(config).read

            settings.tap do |target|
              dbus_settings.each do |dbus_property, dbus_value|
                converter = CONVERSIONS[dbus_property]
                # FIXME: likely ignoring the wrong attribute is not the best
                next unless converter

                send(converter, target, dbus_value)
              end
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_settings

          # @return [Agama::Config]
          attr_reader :config

          # D-Bus attributes and their converters.
          CONVERSIONS = {
            "BootDevice"             => :boot_device_conversion,
            "LVM"                    => :lvm_conversion,
            "SystemVGDevices"        => :system_vg_devices_conversion,
            "EncryptionPassword"     => :encryption_password_conversion,
            "EncryptionMethod"       => :encryption_method_conversion,
            "EncryptionPBKDFunction" => :encryption_pbkd_function_conversion,
            "SpacePolicy"            => :space_policy_conversion,
            "SpaceActions"           => :space_actions_conversion,
            "Volumes"                => :volumes_conversion
          }.freeze
          private_constant :CONVERSIONS

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def boot_device_conversion(target, value)
            target.boot_device = value.empty? ? nil : value
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [Boolean]
          def lvm_conversion(target, value)
            target.lvm.enabled = value
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [Array<String>]
          def system_vg_devices_conversion(target, value)
            target.lvm.system_vg_devices = value
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def encryption_password_conversion(target, value)
            target.encryption.password = value.empty? ? nil : value
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def encryption_method_conversion(target, value)
            method = Y2Storage::EncryptionMethod.find(value.to_sym)
            return unless method

            target.encryption.method = method
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def encryption_pbkd_function_conversion(target, value)
            function = Y2Storage::PbkdFunction.find(value)
            return unless function

            target.encryption.pbkd_function = function
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [String]
          def space_policy_conversion(target, value)
            policy = value.to_sym
            return unless Agama::Storage::SpaceSettings.policies.include?(policy)

            target.space.policy = policy
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [Array<Hash>]
          def space_actions_conversion(target, value)
            target.space.actions = value.each_with_object({}) do |v, result|
              result[v["Device"]] = v["Action"].to_sym
            end
          end

          # @param target [Agama::Storage::ProposalSettings]
          # @param value [Array<Hash>]
          def volumes_conversion(target, value)
            # Keep default volumes if no volumes are given
            return if value.empty?

            required_volumes = target.volumes.select { |v| v.outline.required? }
            volumes = value.map { |v| VolumeConversion.from_dbus(v, config: config) }

            target.volumes = volumes + missing_volumes(required_volumes, volumes)
          end

          # Missing required volumes
          #
          # @param required_volumes [Array<Agama::Storage::Volume>]
          # @param volumes [Array<Agama::Storage::Volume>]
          #
          # @return [Array<Agama::Storage::Volume>]
          def missing_volumes(required_volumes, volumes)
            mount_paths = volumes.map(&:mount_path)

            required_volumes.reject { |v| mount_paths.include?(v.mount_path) }
          end
        end
      end
    end
  end
end
