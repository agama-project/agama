# Copyright (c) [2019] SUSE LLC
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

module Y2Storage
  module Planned
    # Mixin for planned devices that can act as bcache caching/backing devices
    # @see Planned::Device
    module CanBeBcacheMember
      # @return [Array<String>] name of the bcache devices to which this device will serve as
      #   caching
      attr_accessor :bcache_caching_for
      # @return [String,nil] name of the bcache device to which this device will serve as backing
      #   or nil if it is not a backing device
      attr_accessor :bcache_backing_for

      def initialize_can_be_bcache_member
        @bcache_caching_for = []
      end

      # Determines whether the device will be part of a bcache device
      #
      # @return [Boolean]
      def bcache_member?
        bcache_backing_device? || bcache_caching_device?
      end

      # Determines whether the device will act as a caching device
      #
      # @return [Boolean]
      def bcache_caching_device?
        !bcache_caching_for.empty?
      end

      # Determines whether the device will act as a caching device
      #
      # @return [Boolean]
      def bcache_backing_device?
        !bcache_backing_for.nil?
      end

      # Determines whether the device will act as a caching device for a given Bcache
      #
      # @param name [String] bcache name
      def bcache_caching_for?(name)
        bcache_caching_for.include?(name)
      end

      # Determines whether the device will act as a backing device for a given bcache
      #
      # @param name [String] bcache name
      # @return [Boolean]
      def bcache_backing_for?(name)
        bcache_backing_for == name
      end

      # @see Planned::Device#component?
      #
      # @return [Boolean]
      def component?
        super || bcache_member?
      end
    end
  end
end
