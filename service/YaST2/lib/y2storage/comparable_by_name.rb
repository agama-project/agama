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

require "y2storage/device"

module Y2Storage
  # Mixin for classes supporting to be sorted by name in libstorage-ng, offering
  # methods to sort in a Ruby-friendly way and to query the whole sorted
  # collection from a devicegraph.
  #
  # Classes including this mixin should be accepted by {Device.compare_by_name}
  # (defined by libstorage-ng) and should implement the class method .all to
  # query the whole collection from a devicegraph.
  module ComparableByName
    # Compare to another device by name, used for sorting sets of
    # partitionable devices.
    #
    # @see Device.compare_by_name to check which types are accepted as argument
    # (restricted by libstorage-ng).
    #
    # @raise [Storage::Exception] if trying to compare with something that is not
    # supported by libstorage-ng.
    #
    # Using this method to compare and sort would result is something similar
    # to alphabetical order but with some desired exceptions like:
    #
    # * /dev/sda, /dev/sdb, ..., /dev/sdaa
    # * /dev/md1, /dev/md2, ..., /dev/md10
    #
    # Unlike the class method {Device.compare_by_name}, which is boolean,
    # this method follows the Ruby convention of returning -1 or 1 in the same
    # cases than the <=> operator.
    #
    # @param other [BlkDevice, LvmVg]
    # @return [Integer] -1 if this object should appear before the one passed as
    #   argument (less than). 1 otherwise.
    def compare_by_name(other)
      # In practice, two devices cannot have the same name. But let's take the
      # case in consideration to ensure full compatibility with <=>
      return 0 if name == other.name

      Device.compare_by_name(self, other) ? -1 : 1
    end

    # Class methods for the mixin
    module ClassMethods
      # All the devices of the correspondig class found in the given devicegraph,
      # sorted by name
      #
      # See {#compare_by_name} to know more about the sorting.
      #
      # @param devicegraph [Devicegraph]
      # @return [Array<#compare_by_name>]
      def sorted_by_name(devicegraph)
        all(devicegraph).sort { |a, b| a.compare_by_name(b) }
      end
    end

    def self.included(base)
      base.extend(ClassMethods)
    end
  end
end
