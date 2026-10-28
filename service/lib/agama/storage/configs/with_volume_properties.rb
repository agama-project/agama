# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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
require "agama/storage/configs/with_alias"
require "agama/storage/configs/with_filesystem"
require "agama/storage/configs/with_search"
require "agama/storage/configs/with_delete"

module Agama
  module Storage
    module Configs
      # Mixin for configs with volume properties.
      module WithVolumeProperties
        def self.included(base)
          base.extend(ClassMethods)
        end

        # Class methods to build default configs.
        module ClassMethods
          # Volume config meaning "delete all partitions".
          #
          # @return [Configs::Partition]
          def new_for_delete_all
            new.tap do |config|
              config.search = Configs::Search.new_for_search_all
              config.delete = true
            end
          end

          # Volume config meaning "shrink any partitions if needed".
          #
          # @return [Configs::Partition]
          def new_for_shrink_any_if_needed
            new.tap do |config|
              config.search = Configs::Search.new_for_search_all
              config.size = Configs::Size.new_for_shrink_if_needed
            end
          end
        end

        include WithAlias
        include WithFilesystem
        include WithSearch
        include WithDelete

        # @return [Size]
        attr_accessor :size

        # @return [Encryption, nil]
        attr_accessor :encryption

        def initialize_volume_properties
          initialize_delete
          @size = Size.new
        end
      end
    end
  end
end
