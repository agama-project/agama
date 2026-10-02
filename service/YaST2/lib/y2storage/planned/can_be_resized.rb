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

require "yast"

module Y2Storage
  module Planned
    # Mixin for planned devices that can be resized. This mixing depends
    # on Y2Storage::Planned::HasSize being included.
    #
    # @see Planned::Device
    module CanBeResized
      # @return [Boolean] Determines whether the device should be resized
      attr_accessor :resize

      # @see #resize
      #
      # @return [Boolean]
      def resize?
        !!resize
      end

      # Determines whether the device will shrink
      #
      # @param devicegraph [Devicegraph] Device graph to adjust
      # @return [Boolean]
      def shrink?(devicegraph)
        max_size <= device_to_reuse(devicegraph).size
      end

      # Limit the max size to ensure the device does not grow more than a give margin
      #
      # @param max_grow [DiskSize] max margin to grow the device
      # @param devicegraph [Devicegraph]
      def limit_grow(max_grow, devicegraph)
        limit = device_to_reuse(devicegraph).size + max_grow
        self.max_size = [max_size, limit].min
      end

      protected

      # Implements reuse_device! hook
      #
      # @param device [Y2Storage::Device]
      # @see Y2Storage::Planned::Device#reuse_device!
      def reuse_device!(device)
        super

        return unless resize?

        resize_info = device.detect_resize_info
        return unless resize_info.resize_ok?

        resize_device!(device, resize_info)
      end

      # Assigns size to the real device in order to resize it
      #
      # @param device [Y2Storage::Device]
      def resize_device!(device, resize_info)
        device.size =
          if max_size > resize_info.max_size || max_size == DiskSize.unlimited
            resize_info.max_size
          elsif max_size < resize_info.min_size
            resize_info.min_size
          else
            max_size
          end

        if max_size != device.size && max_size != DiskSize.unlimited
          log.warn "Resizing #{reuse_name} to #{max_size} was not possible. " \
                   "Using #{device.size} instead."
        end

        nil
      end
    end
  end
end
