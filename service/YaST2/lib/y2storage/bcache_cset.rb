# Copyright (c) [2018-2019] SUSE LLC
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

module Y2Storage
  # A bcache caching set
  #
  # This is a wrapper for Storage::BcacheCset
  class BcacheCset < Device
    include Yast::I18n
    wrap_class Storage::BcacheCset

    # @!method blk_devices
    #   @return [Array<BlkDevice>] returns a list of devices used as caching ones in this set
    storage_forward :blk_devices, as: "BlkDevice"

    # @!method bcaches
    #   All bcache devices using this caching set.
    #
    #   Note that a caching set can be used for caching data, and also by flash-only bcache
    #   devices for storing data.
    #
    #   @return [Array<Bcache>] returns a list of bcaches using this caching set
    storage_forward :bcaches, as: "Bcache"

    # @!method uuid
    #   @return [String] returns an UUID of set
    storage_forward :uuid

    # @!method self.create(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [BcacheCset]
    storage_class_forward :create, as: "Bcache"

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<BcacheCset>] all the bcache_csets in the given devicegraph,
    #     in no particular order
    storage_class_forward :all, as: "BcacheCset"

    def inspect
      "<BcacheCset uuid:#{uuid} #{blk_devices.inspect}>"
    end

    # Display name to represent the caching set
    #
    # @return [String]
    def display_name
      textdomain "storage"
      devices = bcaches.map(&:basename).sort.join(", ")
      # TRANSLATORS: status when cache set is not attached to any bcache
      return _("Cache set (not attached)") if devices.empty?

      # TRANSLATORS: %s contain list of devices for which cache act as cache.
      format(_("Cache set (%s)"), devices)
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :bcache_cset
    end
  end
end
