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
require "agama/storage/configs/with_alias"

module Agama
  module Storage
    module Configs
      # Section of the configuration representing a LVM logical volume.
      class LogicalVolume
        include WithAlias

        # @return [String, nil]
        attr_accessor :name

        # @return [Size]
        attr_accessor :size

        # @return [Integer, nil]
        attr_accessor :stripes

        # @return [Y2Storage::DiskSize, nil]
        attr_accessor :stripe_size

        # @return [Boolean]
        attr_accessor :pool
        alias_method :pool?, :pool

        # @return [String, nil]
        attr_accessor :used_pool

        # @return [Encryption, nil]
        attr_accessor :encryption

        # @return [Filesystem, nil]
        attr_accessor :filesystem

        def initialize
          @size = Size.new
          @pool = false
        end

        # Whether the config represents a thin logical volume.
        #
        # @return [Boolean]
        def thin_volume?
          !used_pool.nil?
        end
      end
    end
  end
end
