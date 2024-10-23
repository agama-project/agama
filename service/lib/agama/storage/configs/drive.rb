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

require "agama/storage/configs/search"
require "agama/storage/configs/with_alias"
require "agama/storage/configs/with_search"

module Agama
  module Storage
    module Configs
      # Section of the configuration representing a device that is expected to exist in the target
      # system and that can be used as a regular disk.
      class Drive
        include WithAlias
        include WithSearch

        # @return [Encryption, nil]
        attr_accessor :encryption

        # @return [Filesystem, nil]
        attr_accessor :filesystem

        # @return [Y2Storage::PartitionTables::Type, nil]
        attr_accessor :ptable_type

        # @return [Array<Partition>]
        attr_accessor :partitions

        # Constructor
        def initialize
          @partitions = []
          # All drives are expected to match a real device in the system, so let's ensure a search.
          @search = Search.new.tap { |s| s.max = 1 }
        end

        # Whether the drive definition contains partition definitions
        #
        # @return [Boolean]
        def partitions?
          partitions.any?
        end
      end
    end
  end
end
