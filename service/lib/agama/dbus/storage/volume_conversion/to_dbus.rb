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

module Agama
  module DBus
    module Storage
      module VolumeConversion
        # Utility class offering methods to convert volumes between Agama and D-Bus formats
        #
        # @note In the future this class might be not needed if proposal volumes and templates are
        #   exported as objects in D-Bus.
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
              "MountPath"             => volume.mount_path.to_s,
              "TargetDevice"          => volume.target_device.to_s,
              "TargetVG"              => volume.target_vg.to_s,
              "FsType"                => volume.fs_type&.to_human_string,
              "MinSize"               => volume.min_size&.to_i,
              "MaxSize"               => volume.max_size&.to_i,
              "AutoSize"              => volume.auto_size?,
              "Snapshots"             => volume.btrfs.snapshots?,
              "Outline"               => outline
            }
          end

        private

          # @return [Storage::Volume]
          attr_reader :volume

          def outline
            outline = volume.outline
            {
              "Required"              => outline.required?,
              "FsTypes"               => outline.fs_types.map(&:to_human_string),
              "SupportAutoSize"       => outline.support_auto_size?,
              "SnapshotsConfigurable" => outline.snapshots_configurable?,
              "SnapshotsAffectSizes"  => outline.snapshots_affect_sizes?,
              "SizeRelevantVolumes"   => outline.size_relevant_volumes
            }
          end
        end
      end
    end
  end
end
