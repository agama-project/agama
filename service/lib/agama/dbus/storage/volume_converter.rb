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
require "y2storage/disk_size"
require "y2storage/filesystems/type"

module Agama
  module DBus
    module Storage
      # Utility class offering methods to convert volumes between Agama and D-Bus formats
      #
      # @note In the future this class might be not needed if proposal volumes and templates are
      #   exported as objects in D-Bus.
      class VolumeConverter
        # Converts the given D-Bus volume to its equivalent Agama::Volume object
        #
        # @param dbus_volume [Hash]
        # @return [Storage::Volume]
        def to_agama(dbus_volume)
          ToAgama.new(dbus_volume).convert
        end

        # Converts the given volume to its equivalent D-Bus volume

        # @param volume [Storage::Volume]
        # @return [Hash]
        def to_dbus(volume)
          ToDBus.new(volume).convert
        end

        # Internal class to generate a Agama volume
        class ToAgama
          # Constructor
          #
          # @param dbus_volume [Hash]
          def initialize(dbus_volume)
            @dbus_volume = dbus_volume
          end

          # @return [Storage::Volume]
          def convert
            Agama::Storage::Volume.new.tap do |volume|
              dbus_volume.each do |dbus_property, dbus_value|
                setter, value_converter = VOLUME_CONVERSIONS[dbus_property]
                volume.public_send(setter, value_converter.call(dbus_value, self))
              end
            end
          end

        private

          # @return [Hash]
          attr_reader :dbus_volume

          # Relationship between D-Bus volumes and Volumes
          #
          # For each D-Bus volume setting there is a list with the setter to use and the conversion
          # from a D-Bus value to the value expected by the Volume setter.
          VOLUME_CONVERSIONS = {
            "MountPoint"      => ["mount_point=", proc { |v| v }],
            "DeviceType"      => ["device_type=", proc { |v| v.to_sym }],
            "Encrypted"       => ["encrypted=", proc { |v| v }],
            "FsType"          => ["fs_type=", proc { |v, o| o.send(:to_fs_type, v) }],
            "MinSize"         => ["min_size=", proc { |v| Y2Storage::DiskSize.new(v) }],
            "MaxSize"         => ["max_size=", proc { |v| Y2Storage::DiskSize.new(v) }],
            "FixedSizeLimits" => ["fixed_size_limits=", proc { |v| v }],
            "Snapshots"       => ["snapshots=", proc { |v| v }]
          }.freeze
          private_constant :VOLUME_CONVERSIONS

          # Converts a filesystem type from D-Bus format to a real filesystem type object
          #
          # @param dbus_fs_type [String]
          # @return [Y2Storage::Filesystems::Type]
          def to_fs_type(dbus_fs_type)
            Y2Storage::Filesystems::Type.all.find { |t| t.to_human_string == dbus_fs_type }
          end
        end

        # Internal class to generate a D-Bus volume
        class ToDBus
          # Constructor
          #
          # @param volume [Storage::Volume]
          def initialize(volume)
            @volume = volume
          end

          # @return [Hash]
          def convert # rubocop:disable Metrics/AbcSize
            dbus_volume = {
              "MountPoint"            => volume.mount_point,
              "Optional"              => volume.optional,
              "DeviceType"            => volume.device_type.to_s,
              "Encrypted"             => volume.encrypted,
              "FsTypes"               => volume.fs_types.map(&:to_human_string),
              "FsType"                => volume.fs_type&.to_human_string,
              "MinSize"               => volume.min_size&.to_i,
              "MaxSize"               => volume.max_size&.to_i,
              "FixedSizeLimits"       => volume.fixed_size_limits,
              "AdaptiveSizes"         => volume.adaptive_sizes?,
              "Snapshots"             => volume.snapshots,
              "SnapshotsConfigurable" => volume.snapshots_configurable,
              "SnapshotsAffectSizes"  => volume.snapshots_affect_sizes?,
              "SizeRelevantVolumes"   => volume.size_relevant_volumes
            }

            dbus_volume.compact.reject { |_, v| v.respond_to?(:empty?) && v.empty? }
          end

        private

          # @return [Storage::Volume]
          attr_reader :volume
        end
      end
    end
  end
end
