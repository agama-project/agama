# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "y2storage"

module Agama
  module Storage
    module VolumeConversions
      # Volume conversion to JSON hash according to schema.
      #
      # This class was in the past meant to convert the 'volumes' section of the ProposalSettings,
      # when we used to have a Guided strategy. So each conversion represented a volume that was
      # meant to be part of the proposal (as a new partition, LV, etc.). That Guided strategy does
      # not exist anymore.
      #
      # Now the volumes are only used to describe the templates used by the product to represent
      # the suggested/acceptable settings for each mount point, since the class Volume is still
      # (ab)used for that purpose. Thus, this conversion now serves that purpose.
      class ToJSON
        # @param volume [Volume]
        def initialize(volume)
          @volume = volume
        end

        # Performs the conversion to JSON.
        #
        # @return [Hash]
        def convert
          {
            mountPath:    volume.mount_path.to_s,
            mountOptions: volume.mount_options,
            fsType:       fs_type_conversion,
            minSize:      min_size_conversion,
            autoSize:     volume.auto_size?,
            outline:      outline_conversion
          }.tap do |volume_json|
            # Some volumes could not have "MaxSize".
            max_size_conversion(volume_json)
          end
        end

      private

        # @return [Volume]
        attr_reader :volume

        # @return [Integer]
        def min_size_conversion
          min_size = volume.min_size
          min_size = volume.outline.base_min_size if volume.auto_size?
          min_size.to_i
        end

        # @param json [Hash]
        def max_size_conversion(json)
          max_size = volume.max_size
          max_size = volume.outline.base_max_size if volume.auto_size?
          return if max_size.unlimited?

          json[:maxSize] = max_size.to_i
        end

        # Converts volume outline to D-Bus.
        #
        # @return [Hash<Symbol, Object>]
        #   * required [Boolean]
        #   * fsTypes [Array<String>]
        #   * supportAutoSize [Boolean]
        #   * adjustByRam [Boolean]
        #   * snapshotsConfigurable [Boolean]
        #   * snapshotsAffectSizes [Boolean]
        #   * sizeRelevantVolumes [Array<String>]
        def outline_conversion
          outline = volume.outline

          {
            required:             outline.required?,
            fsTypes:              fs_types_conversion(outline),
            supportAutoSize:      outline.adaptive_sizes?,
            adjustByRam:          outline.adjust_by_ram?,
            snapshotsAffectSizes: outline.snapshots_affect_sizes?,
            sizeRelevantVolumes:  outline.size_relevant_volumes
          }
        end

        # @see #convert
        def fs_type_conversion
          type = volume.fs_type&.to_s || ""
          if type == "btrfs"
            return "btrfsImmutable" if volume.btrfs.read_only?
            return "btrfsSnapshots" if volume.btrfs.snapshots?
          end
          type
        end

        # @see #outline_conversion
        def fs_types_conversion(outline)
          types = outline.filesystems.map(&:to_s)
          if types.include?("btrfs")
            idx = types.index("btrfs")

            if volume.btrfs.read_only?
              types[idx] = "btrfsImmutable"
            elsif outline.snapshots_configurable?
              types = types[0..idx] + ["btrfsSnapshots"] + types[idx + 1..-1]
            elsif volume.btrfs.snapshots?
              types[idx] = "btrfsSnapshots"
            end
          end

          types
        end
      end
    end
  end
end
