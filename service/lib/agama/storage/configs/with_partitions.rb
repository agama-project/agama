# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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
      # Mixin for configs with partitions.
      module WithPartitions
        # @return [Y2Storage::PartitionTables::Type, nil]
        attr_accessor :ptable_type

        # @return [Array<Partition>]
        attr_accessor :partitions

        # Sets initial value for partitions.
        def initialize_partitions
          @partitions = []
        end

        # Whether the config contains partition definitions.
        #
        # @return [Boolean]
        def partitions?
          partitions.any?
        end
      end
    end
  end
end
