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

require "y2storage/storage_manager"
require "agama/storage/volume_templates_builder"

module Agama
  module Storage
    module VolumeConversion
      # Volume conversion from Y2Storage format.
      class FromY2Storage
        # @param spec [Y2Storage::VolumeSpecification]
        # @param config [Agama::Config]
        def initialize(spec, config:)
          @spec = spec
          @config = config
        end

        # Performs the conversion from Y2Storage format.
        #
        # @return [Agama::Storage::Volume]
        def convert
          volume = VolumeTemplatesBuilder.new_from_config(config).for(spec.mount_point || "")

          volume.tap do |target|
            target.mount_options = spec.mount_options
            target.fs_type = spec.fs_type

            sizes_conversion(target)
            btrfs_conversion(target)
            location_conversion(target)
          end
        end

      private

        # @return [Y2Storage::VolumeSpecification]
        attr_reader :spec

        # @return [Agama::Config]
        attr_reader :config

        # @param target [Agama::Storage::Volume]
        def sizes_conversion(target)
          target.auto_size = !spec.ignore_fallback_sizes? || !spec.ignore_snapshots_sizes?

          # The volume specification contains the min and max sizes for the volume. But the final
          # range of sizes used by the Y2Storage proposal depends on the fallback sizes (if this
          # volume is fallback for other volume) and the size for snapshots (if snapshots is
          # active). The planned device contains the real range of sizes used by the proposal.
          #
          # From Agama point of view, this is the way of recovering the range of sizes used by
          # Y2Storage when a volume is set to have auto size.
          planned = planned_device_for(spec.mount_point)
          target.min_size = planned&.min || spec.min_size
          target.max_size = planned&.max || spec.max_size
        end

        # @param target [Agama::Storage::Volume]
        def btrfs_conversion(target)
          target.btrfs.snapshots = spec.snapshots?
          target.btrfs.subvolumes = spec.subvolumes
          target.btrfs.default_subvolume = spec.btrfs_default_subvolume
          target.btrfs.read_only = spec.btrfs_read_only
        end

        # @param target [Agama::Storage::Volume]
        def location_conversion(target)
          if spec.reuse?
            target.location.target = spec.reformat? ? :device : :filesystem
            target.location.device = spec.reuse_name
          elsif !!spec.device
            target.location.target = spec.separate_vg? ? :new_vg : :new_partition
            target.location.device = spec.device
          end
        end

        # Planned device for the given mount path.

        # @param mount_path [String]
        # @return [Y2Storage::Planned::Device, nil]
        def planned_device_for(mount_path)
          planned_devices = proposal&.planned_devices || []
          planned_devices.find { |d| d.respond_to?(:mount_point) && d.mount_point == mount_path }
        end

        # Current proposal.
        #
        # @return [Y2Storage::Proposal, nil]
        def proposal
          Y2Storage::StorageManager.instance.proposal
        end
      end
    end
  end
end
