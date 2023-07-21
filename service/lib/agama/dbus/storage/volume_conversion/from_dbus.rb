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
require "agama/storage/volume_templates_builder"
require "y2storage/disk_size"
require "y2storage/filesystems/type"

module Agama
  module DBus
    module Storage
      module VolumeConversion
        # Utility class offering methods to convert volumes between Agama and D-Bus formats
        #
        # @note In the future this class might be not needed if proposal volumes and templates are
        #   exported as objects in D-Bus.
        # Internal class to generate a Agama volume
        class FromDBus
          # Constructor
          #
          # @param dbus_volume [Hash]
          def initialize(dbus_volume, config:)
            @dbus_volume = dbus_volume
            @config = config
          end

          # @return [Storage::Volume]
          def convert
            volume = volume_for(dbus_volume["MountPath"])
            dbus_volume.each do |dbus_property, dbus_value|
              send(CONVERSIONS[dbus_property], volume, dbus_value)
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_volume

          attr_reader :config

          # Relationship between D-Bus volumes and Volumes
          #
          # For each D-Bus volume setting there is a list with the setter to use and the conversion
          # from a D-Bus value to the value expected by the Volume setter.
          CONVERSIONS = {
            "MountPath"       => :mount_path_conversion,
            "MountOptions"    => :mount_options_conversion,
            "TargetDevice"    => :target_device_conversion,
            "TargetVG"        => :target_vg_conversion,
            "FsType"          => :fs_type_conversion,
            "MinSize"         => :min_size_conversion,
            "MaxSize"         => :max_size_conversion,
            "AutoSize"        => :auto_size_conversion,
            "Snapshots"       => :snapshots_conversion
          }.freeze
          private_constant :CONVERSIONS

          def mount_path_conversion(volume, value)
            volume.mount_path = value
          end

          def mount_options_conversion(volume, value)
            volume.mount_options = value
          end

          def target_device_conversion(volume, value)
            volume.device = value
          end

          def target_vg_conversion(volume, value)
            volume.separate_vg_name = value
          end

          def fs_type_conversion(volume, value)
            fs_type = Y2Storage::Filesystems::Type.all.find { |t| t.to_human_string == value }
            volume.fs_type = fs_type
          end

          def min_size_conversion(volume, value)
            volume.min_size = Y2Storage::DiskSize.new(value)
          end

          def max_size_conversion(volume, value)
            volume.max_size = Y2Storage::DiskSize.new(value)
          end

          def auto_size_conversion(volume, value)
            volume.auto_size = value
          end

          def snapshots_conversion(volume, value)
            volume.btrfs.snapshots = value
          end

          def volume_for(mount_path)
            volume_templates_builder.for(mount_path)
          end

          def volume_templates_builder
            @volume_templates_builder ||= VolumeTemplatesBuilder.new_from_config(config)
          end
        end
      end
    end
  end
end
