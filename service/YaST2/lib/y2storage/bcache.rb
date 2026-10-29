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
require "y2storage/partitionable"
require "y2storage/bcache_type"

Yast.import "Arch"

module Y2Storage
  # A bcache device
  #
  # A bcache device can use a backing device to store the data or it can be
  # directly created over a caching set (flash-only bcache).
  #
  # This is a wrapper for Storage::Bcache
  class Bcache < Partitionable
    wrap_class Storage::Bcache

    # @!method bcache_cset
    #   @return [BcacheCset, nil] returns associated bcache cset
    storage_forward :bcache_cset, as: "BcacheCset", check_with: :has_bcache_cset

    # @!method type
    #   Type of the bcache device (backed or flash-only)
    #
    #   @return [BcacheType]
    storage_forward :type, as: "BcacheType"

    # @!method backing_device
    #   Backing device used by this bcache.
    #
    #   This method does not make sense for flash-only bcache devices.
    #
    #   @return [BlkDevice, nil] nil for flash-only bcache
    storage_forward :backing_device, as: "BlkDevice"

    # @!method add_bcache_cset(set)
    #   This method does not make sense for flash-only bcache devices.
    #
    #   @raise [storage::Exception] if attaching failed
    #   @raise [storage::LogicException] for a flash-only bcache device or when
    #     the bcache device already has a caching set.
    #
    #   @param set [BcacheCset] set to attach
    storage_forward :add_bcache_cset

    # @!method remove_bcache_cset
    #   This method does not make sense for flash-only bcache devices.
    #
    #   @raise [storage::Exception] if detaching failed
    #   @raise [storage::LogicException] for a flash-only bcache device or when
    #     the bcache device has no caching set.
    storage_forward :remove_bcache_cset

    # @!attribute cache_mode
    #   Mode in which cache operates.
    #
    #   This method does not make sense for flash-only bcache devices and its value
    #   should not be taken into account. If setter is called for a flash-only bcache,
    #   the value will be ignored by libstorage-ng when creating or editing the device.
    #
    #   @return [CacheMode]
    storage_forward :cache_mode, as: "CacheMode"
    storage_forward :cache_mode=

    # @!method writeback_percent
    #   Target percent of dirty pages in writeback mode.
    #
    #   This method does not make sense for flash-only bcache devices and its value
    #   should not be taken into account.
    #
    #   @return [Integer]
    storage_forward :writeback_percent

    # @!method sequential_cutoff
    #   Size for cache consider read as sequential and do not cache it.
    #
    #   This method does not make sense for flash-only bcache devices and its value
    #   should not be taken into account.
    #
    #   @return [DiskSize]
    storage_forward :sequential_cutoff, as: "DiskSize"

    # @!method self.create(devicegraph, name, type = BcacheType::BACKED)
    #   @param devicegraph [Devicegraph]
    #   @param name [String]
    #   @param type [BcacheType]
    #
    #   @return [Bcache]
    storage_class_forward :create, as: "Bcache"

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<Bcache>] all the bcache devices in the given devicegraph,
    #     in no particular order
    storage_class_forward :all, as: "Bcache"

    # @!method self.find_by_name(devicegraph, name)
    #   @param devicegraph [Devicegraph]
    #   @param name [String] kernel-style device name (e.g. "/dev/bcache0")
    #   @return [Bcache] nil if there is no such device
    storage_class_forward :find_by_name, as: "Bcache"

    # @!method self.find_free_name(devicegraph)
    #   Returns available free name for bcache device.
    #   @param devicegraph [Devicegraph] in which search for free name
    #   @return [String] full path to new bcache device like "/dev/bcache3"
    storage_class_forward :find_free_name

    # Whether the bcache is flash-only
    #
    # @return [Boolean]
    def flash_only?
      type.is?(:flash_only)
    end

    def inspect
      flash_only? ? flash_only_inspect : backed_inspect
    end

    # Check if bcache is supported on this platform.
    # Notice that this is for both bcache and bcache_cset.
    #
    # @return [Boolean]
    def self.supported?
      # So far, bcache is only supported on x86_64 (JIRA#SLE-4329)
      Yast::Arch.x86_64
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :bcache
    end

    def backed_inspect
      if bcache_cset
        "<Bcache #{name} #{bcache_cset.inspect} -> #{backing_device.inspect}>"
      else
        "<Bcache #{name} without caching set -> #{backing_device.inspect}>"
      end
    end

    def flash_only_inspect
      "<Bcache #{name} flash-only (#{size}) -> #{bcache_cset.inspect}>"
    end
  end
end
