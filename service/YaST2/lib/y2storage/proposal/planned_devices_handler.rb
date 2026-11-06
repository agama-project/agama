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

module Y2Storage
  module Proposal
    # Mixin with methods to handle planned device collections
    module PlannedDevicesHandler
      include Yast::Logger

      # Removes shadowed subvolumes from each planned device that can be mounted
      #
      # Note this does not alter the collection itself, but it modifies the attributes of
      # some of the elements in the collection
      #
      # @param planned_devices [Planned::DevicesCollection]
      def remove_shadowed_subvols(planned_devices)
        planned_devices.mountable_devices.each do |device|
          # Some planned devices could be mountable but not formattable (e.g., {Planned::Nfs}).
          # Those devices might shadow some subvolumes but they do not have any subvolume to
          # be shadowed.
          next unless device.respond_to?(:shadowed_subvolumes)

          device.shadowed_subvolumes(planned_devices.mountable_devices).each do |subvol|
            log.info "Subvolume #{subvol} would be shadowed. Removing it."
            device.subvolumes.delete(subvol)
          end
        end
      end
    end
  end
end
