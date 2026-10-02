# Copyright (c) [2017] SUSE LLC
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

require "y2storage/storage_class_wrapper"
require "y2storage/partition_type"

module Y2Storage
  module PartitionTables
    # An available slot within a partition table. That is, a space that can be
    # used to create a new partition.
    #
    # This is a wrapper for Storage::PartitionSlot
    class PartitionSlot
      include StorageClassWrapper
      wrap_class Storage::PartitionSlot

      # @!method region
      #   @return [Region] region defining the slot
      storage_forward :region, as: "Region"

      # @!method nr
      #   @return [Integer] number of the possible new partition
      storage_forward :nr

      # @!method name
      #   @return [String] candidate name for the possible new partition
      storage_forward :name

      # @!method possible?(partition_type)
      #   Checks whether is possible to create a partition of the
      #   given type within the slot.
      #
      #   @param partition_type [PartitionType]
      #   @return [Boolean]
      storage_forward :possible?

      storage_forward :primary_slot?, to: :primary_slot
      private :primary_slot?

      storage_forward :primary_possible?, to: :primary_possible
      private :primary_possible?

      storage_forward :extended_slot?, to: :extended_slot
      private :extended_slot?

      storage_forward :extended_possible?, to: :extended_possible
      private :extended_possible?

      storage_forward :logical_slot?, to: :logical_slot
      private :logical_slot?

      storage_forward :logical_possible?, to: :logical_possible
      private :logical_possible?

      def inspect
        nice_size = Y2Storage::DiskSize.B(region.length * region.block_size.to_i)
        "<PartitionSlot #{nr} #{name} #{flags_string} #{nice_size}, #{region.show_range}>"
      end

      alias_method :to_s, :inspect

      # Whether the slot can be used to create a partition of any type
      #
      # @return [Boolean]
      def available?
        PartitionType.all.any? { |part| possible?(part) }
      end

      private

      def flags_string
        flags = ""
        flags << "P" if primary_slot?
        flags << "p" if primary_possible?
        flags << "E" if extended_slot?
        flags << "e" if extended_possible?
        flags << "L" if logical_slot?
        flags << "l" if logical_possible?
        flags
      end
    end
  end
end
