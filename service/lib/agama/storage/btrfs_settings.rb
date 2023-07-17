# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
    # Settings regarding Btrfs for a given Volume
    class BtrfsSettings
      # Whether the volume contains Btrfs snapshots
      #
      # @return [Boolean]
      attr_accessor :snapshots

      # @return [Boolean]
      attr_accessor :read_only

      # @return [Array<String>]
      attr_accessor :subvolumes

      # @return [String]
      attr_accessor :default_subvolume

      def initialize
        @snapshots = false
        @read_only = false
        @subvolumes = []
        @default_subvolume = "@"
      end

      def load_features(values)
      end
    end
  end
end
