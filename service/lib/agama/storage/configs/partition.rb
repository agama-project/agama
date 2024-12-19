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

require "agama/storage/configs/size"
require "agama/storage/configs/with_search"
require "agama/storage/configs/with_alias"

module Agama
  module Storage
    module Configs
      # Section of the configuration representing a partition
      class Partition
        # Partition config meaning "delete all partitions".
        #
        # @return [Configs::Partition]
        def self.new_for_delete_all
          new.tap do |config|
            config.search = Configs::Search.new_for_search_all
            config.delete = true
          end
        end

        # Partition config meaning "shrink any partitions if needed".
        #
        # @return [Configs::Partition]
        def self.new_for_shrink_any_if_needed
          new.tap do |config|
            config.search = Configs::Search.new_for_search_all
            config.size = Configs::Size.new_for_shrink_if_needed
          end
        end

        include WithAlias
        include WithSearch

        # @return [Boolean]
        attr_accessor :delete
        alias_method :delete?, :delete

        # @return [Boolean]
        attr_accessor :delete_if_needed
        alias_method :delete_if_needed?, :delete_if_needed

        # @return [Y2Storage::PartitionId, nil]
        attr_accessor :id

        # @return [Size]
        attr_accessor :size

        # @return [Encryption, nil]
        attr_accessor :encryption

        # @return [Filesystem, nil]
        attr_accessor :filesystem

        def initialize
          @size = Size.new
          @delete = false
          @delete_if_needed = false
        end
      end
    end
  end
end
