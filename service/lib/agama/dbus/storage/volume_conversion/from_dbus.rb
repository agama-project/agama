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

require "agama/storage/volume"
require "agama/storage/volume_location"
require "agama/storage/volume_templates_builder"
require "y2storage/disk_size"
require "y2storage/filesystems/type"

module Agama
  module DBus
    module Storage
      module VolumeConversion
        # Volume conversion from D-Bus format.
        class FromDBus
          # @param dbus_volume [Hash]
          # @param config [Agama::Config]
          def initialize(dbus_volume, config:)
            @dbus_volume = dbus_volume
            @config = config
          end

          # Performs the conversion from D-Bus format.
          #
          # @return [Agama::Storage::Volume]
          def convert
            builder = Agama::Storage::VolumeTemplatesBuilder.new_from_config(config)
            volume = builder.for(dbus_volume["MountPath"] || "")

            volume.tap do |target|
              dbus_volume.each do |dbus_property, dbus_value|
                converter = CONVERSIONS[dbus_property]
                # FIXME: likely ignoring the wrong attribute is not the best
                next unless converter

                send(converter, target, dbus_value)
              end
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_volume

          # @return [Agama::Config]
          attr_reader :config

          # D-Bus attributes and their converters.
          CONVERSIONS = {
            "MountPath"    => :mount_path_conversion,
            "MountOptions" => :mount_options_conversion,
            "Target"       => :target_conversion,
            "TargetDevice" => :target_device_conversion,
            "FsType"       => :fs_type_conversion,
            "MinSize"      => :min_size_conversion,
            "MaxSize"      => :max_size_conversion,
            "AutoSize"     => :auto_size_conversion,
            "Snapshots"    => :snapshots_conversion
          }.freeze
          private_constant :CONVERSIONS

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def mount_path_conversion(target, value)
            target.mount_path = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Array<String>]
          def mount_options_conversion(target, value)
            target.mount_options = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def target_device_conversion(target, value)
            target.location.device = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def target_conversion(target, value)
            target_value = value.downcase.to_sym
            return unless Agama::Storage::VolumeLocation.targets.include?(target_value)

            target.location.target = target_value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [String]
          def fs_type_conversion(target, value)
            downcase_value = value.downcase

            fs_type = target.outline.filesystems.find do |type|
              type.to_human_string.downcase == downcase_value
            end

            return unless fs_type

            target.fs_type = fs_type
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Integer] Size in bytes.
          def min_size_conversion(target, value)
            target.min_size = Y2Storage::DiskSize.new(value)
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Integer] Size in bytes.
          def max_size_conversion(target, value)
            target.max_size = Y2Storage::DiskSize.new(value)
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Boolean]
          def auto_size_conversion(target, value)
            return unless target.auto_size_supported?

            target.auto_size = value
          end

          # @param target [Agama::Storage::Volume]
          # @param value [Booelan]
          def snapshots_conversion(target, value)
            return unless target.outline.snapshots_configurable?

            target.btrfs.snapshots = value
          end
        end
      end
    end
  end
end
