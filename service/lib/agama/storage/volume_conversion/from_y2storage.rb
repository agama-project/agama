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

require "y2storage/storage_manager"

module Agama
  module Storage
    module VolumeConversion
      # Volume conversion from Y2Storage.
      #
      # @note This class does not perform a real conversion from Y2Storage. Instead of that, it
      #   copies the given volume and recovers some values from Y2Storage.
      class FromY2Storage
        # @param volume [Agama::Storage::ProposalSettings]
        def initialize(volume)
          @volume = volume
        end

        # Performs the conversion from Y2Storage.
        #
        # @return [Agama::Storage::Volume]
        def convert
          volume.dup.tap do |target|
            sizes_conversion(target)
          end
        end

      private

        # @return [Agama::Storage::ProposalSettings]
        attr_reader :volume

        # @param target [Agama::Storage::Volume]
        def sizes_conversion(target)
          # The final range of sizes used by the Y2Storage proposal depends on the fallback sizes
          # (if this volume is fallback for other volume) and the size for snapshots (if snapshots
          # is active). The planned device contains the real range of sizes used by the proposal.
          #
          # From Agama point of view, this is the way of recovering the range of sizes used by
          # Y2Storage when a volume is set to have auto size.
          planned = planned_device_for(target.mount_path)
          return unless planned

          target.min_size = planned.min
          target.max_size = planned.max
        end

        # Planned device for the given mount path.
        #
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
