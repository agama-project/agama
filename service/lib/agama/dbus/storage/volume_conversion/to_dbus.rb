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
        # Volume conversion to D-Bus format.
        class ToDBus
          # @param volume [Agama::Storage::Volume]
          def initialize(volume)
            @volume = volume
          end

          # Performs the conversion to D-Bus format.
          #
          # @return [Hash]
          def convert
            {
              "MountPath"     => volume.mount_path.to_s,
              "MountOptions"  => volume.mount_options,
              "TargetDevice"  => volume.device.to_s,
              "TargetVG"      => volume.separate_vg_name.to_s,
              "FsType"        => volume.fs_type&.to_human_string || "",
              "MinSize"       => volume.min_size&.to_i,
              "AutoSize"      => volume.auto_size?,
              "Snapshots"     => volume.btrfs.snapshots?,
              "Transactional" => volume.btrfs.read_only?
            }.tap do |target|
              max_size_conversion(target)
              outline_conversion(target)
            end
          end

        private

          # @return [Agama::Storage::Volume]
          attr_reader :volume

          # @param target [Hash]
          def max_size_conversion(target)
            return if volume.max_size.nil? || volume.max_size.unlimited?

            target["MaxSize"] = volume.max_size.to_i
          end

          # @param target [Hash]
          def outline_conversion(target)
            outline = volume.outline

            target["Outline"] = {
              "Required"              => outline.required?,
              "FsTypes"               => outline.filesystems.map(&:to_human_string),
              "SupportAutoSize"       => outline.adaptive_sizes?,
              "AdjustByRam"           => outline.adjust_by_ram?,
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
