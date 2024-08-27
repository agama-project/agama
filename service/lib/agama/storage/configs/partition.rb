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

module Agama
  module Storage
    module Configs
      # Section of the configuration representing a partition
      class Partition
        # @return [Search, nil]
        attr_accessor :search

        # @return [Y2Storage::PartitionId, nil]
        attr_accessor :id

        # @return [Size, nil] can be nil for reused partitions
        attr_accessor :size

        # @return [Encryption, nil]
        attr_accessor :encryption

        # @return [Filesystem, nil]
        attr_accessor :filesystem

        # Resolves the search if the partition specification contains any, associating a partition
        # of the given device if possible
        #
        # @param partitionable [Y2Storage::Partitionable] scope for the search
        # @param used_sids [Array<Integer>] SIDs of the devices that are already associated to
        #   another partition definition, so they cannot be associated to this
        def search_device(partitionable, used_sids)
          return unless search

          search.find(partitionable.partitions, used_sids)
        end

        # Device resulting from a previous call to {#search_device}
        #
        # @return [Y2Storage::Device, nil]
        def found_device
          search&.device
        end
      end
    end
  end
end
