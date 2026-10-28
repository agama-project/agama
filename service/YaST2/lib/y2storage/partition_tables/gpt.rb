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
require "y2storage/partition_tables/base"

module Y2Storage
  module PartitionTables
    # A GUID partition table
    #
    # This is a wrapper for Storage::Gpt
    class Gpt < Base
      wrap_class Storage::Gpt

      # @!method pmbr_boot?
      #   @return [Boolean] whether protective MBR flag is set
      storage_forward :pmbr_boot?

      # @!method pmbr_boot=(value)
      #   @attr value [Boolean] set/unset flag
      storage_forward :pmbr_boot=

      # GPT partition table doesn't use that many different ids.
      # @see PatitionTables::Base#partition_id_for
      #
      # @param partition_id [PartitionId]
      # @return [PartitionId]
      def partition_id_for(partition_id)
        case partition_id.to_sym
        when :ntfs, :dos32, :dos16, :dos12
          PartitionId::WINDOWS_BASIC_DATA
        else
          super
        end
      end
    end
  end
end
