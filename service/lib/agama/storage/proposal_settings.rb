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

require "agama/storage/boot_settings"
require "agama/storage/device_settings"
require "agama/storage/encryption_settings"
require "agama/storage/proposal_settings_conversions"
require "agama/storage/space_settings"

module Agama
  module Storage
    # Settings used to calculate an storage proposal.
    class ProposalSettings
      # Target device settings.
      #
      # @return [DeviceSettings::Disk, DeviceSettings::NewLvmVg, DeviceSettings::ReusedLvmVg]
      attr_accessor :device

      # Boot settings.
      #
      # @return [BootSettings]
      attr_accessor :boot

      # Encryption settings.
      #
      # @return [EncryptionSettings]
      attr_accessor :encryption

      # Settings to configure the behavior when making space to allocate the new partitions.
      #
      # @return [SpaceSettings]
      attr_accessor :space

      # Set of volumes to create.
      #
      # @return [Array<Volume>]
      attr_accessor :volumes

      def initialize
        @device = DeviceSettings::Disk.new
        @boot = BootSettings.new
        @encryption = EncryptionSettings.new
        @space = SpaceSettings.new
        @volumes = []
      end

      # All devices involved in the installation.
      #
      # @return [Array<String>]
      def installation_devices
        [boot_device, target_devices, volume_devices]
          .flatten
          .compact
          .uniq
      end

      # Default device to use for configuring boot.
      #
      # @return [String, nil]
      def default_boot_device
        case device
        when DeviceSettings::Disk
          device.name
        when DeviceSettings::NewLvmVg
          device.candidate_pv_devices.min
        when DeviceSettings::ReusedLvmVg
          # TODO: Decide what device to use.
        end
      end

      # Creates a new proposal settings object from JSON hash according to schema.
      #
      # @param settings_json [Hash]
      # @param config [Config]
      #
      # @return [ProposalSettings]
      def self.new_from_json(settings_json, config:)
        Storage::ProposalSettingsConversions::FromJSON.new(settings_json, config: config).convert
      end

      # Generates a JSON hash according to schema.
      #
      # @return [Hash]
      def to_json_settings
        Storage::ProposalSettingsConversions::ToJSON.new(self).convert
      end

    private

      # Device used for booting.
      #
      # @return [String, nil]
      def boot_device
        return nil unless boot.configure?

        boot.device
      end

      # Target devices for the installation depending on the device settings.
      #
      # @return [Array<String>]
      def target_devices
        case device
        when DeviceSettings::Disk, DeviceSettings::ReusedLvmVg
          [device.name].compact
        when DeviceSettings::NewLvmVg
          device.candidate_pv_devices
        else
          []
        end
      end

      # Devices directly assigned to the volumes.
      #
      # @return [Array<String>]
      def volume_devices
        volumes.map(&:location).reject(&:reuse_device?).map(&:device)
      end
    end
  end
end
