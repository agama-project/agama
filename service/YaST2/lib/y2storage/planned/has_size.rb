# Copyright (c) [2015-2017] SUSE LLC
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
require "y2storage/disk_size"

module Y2Storage
  module Planned
    # Mixin enabling some classes of planned devices to specify the size of the
    # final device in a flexible way.
    # @see Planned::Device
    module HasSize
      # @return [DiskSize] definitive size of the device
      attr_accessor :size

      # @!attribute min_size
      #   minimum acceptable size
      #
      #   @return [DiskSize] zero for reused volumes
      attr_writer :min_size

      # @return [DiskSize] maximum acceptable size
      attr_accessor :max_size

      # @return [Integer] percentage of the container's size to be used by this volume (used
      #   when the container's size cannot be determined in advance)
      attr_accessor :percent_size

      # @return [Float] factor used to distribute the extra space
      #   between devices
      attr_accessor :weight

      # Initializations of the mixin, to be called from the class constructor.
      def initialize_has_size
        self.size     = DiskSize.zero
        self.min_size = DiskSize.zero
        self.max_size = DiskSize.unlimited
        self.weight   = 0
      end

      def min_size
        # No need to provide space for reused volumes
        (respond_to?(:reuse_name) && reuse_name) ? DiskSize.zero : @min_size
      end

      # Determines the size which should take within a container device
      #
      # @param container [BlkDevice] Container device
      # @return [DiskSize]
      def size_in(container)
        (container.size * percent_size / 100).floor(container.block_size)
      end

      alias_method :min, :min_size
      alias_method :max, :max_size
      alias_method :percent, :percent_size
      alias_method :min=, :min_size=
      alias_method :max=, :max_size=
      alias_method :percent=, :percent_size=

      # Class methods for the mixin
      module ClassMethods
        include Yast::Logger

        # Returns a copy of the list in which the given space has been distributed
        # among the devices, distributing the extra space (beyond the min size)
        # according to the weight and max size of each device.
        #
        # @raise [RuntimeError] if the given space is not enough to reach the min
        #     size for all devices
        #
        # If the optional argument rounding is used, space will be distributed
        # always in blocks of the specified size.
        #
        # @param devices [Array] devices to distribute the space among. All of
        #     them should be of a class including this mixin.
        # @param space_size [DiskSize]
        # @param rounding [DiskSize, nil] min block size to distribute. Mainly used
        #     to distribute space among LVs honoring the PE size of the LVM
        # @param align_grain [DiskSize, nil] align grain for the disk where the space
        #     is located. It only makes sense when distributing space among
        #     partitions.
        # @return [Array] list containing devices with an adjusted value
        #     for Planned::HasSize#size
        def distribute_space(devices, space_size, rounding: nil, align_grain: nil, end_alignment: false)
          check_size(devices, space_size)

          rounding ||= align_grain || DiskSize.new(1)

          new_list = init_sizes(devices, rounding)
          # The last space is extended until the end if we are working with partitions (align_grain is
          # not nil) and the partition table allows that (end_alignment is false)
          adjust_to_end = !align_grain.nil? && !end_alignment

          adjust_size_to_last_slot(new_list.last, space_size, align_grain) if adjust_to_end
          extra_size = space_size - DiskSize.sum(new_list.map(&:size))
          unused = distribute_extra_space!(new_list, extra_size, rounding)
          new_list.last.size += unused if adjust_to_end && unused < align_grain

          new_list
        end

        protected

        # @return [DiskSize] Surplus space that could not be distributed
        def distribute_extra_space!(candidates, extra_size, rounding)
          while distributable?(extra_size, rounding)
            candidates = extra_space_candidates(candidates)
            return extra_size if candidates.empty?
            return extra_size if total_weight(candidates).zero?

            log.info("Distributing #{extra_size} extra space among #{candidates.size} devices")

            assigned_size = DiskSize.zero
            total_weight = total_weight(candidates)
            candidates.each do |dev|
              device_extra = device_extra_size(dev, extra_size, total_weight, assigned_size, rounding)
              dev.size += device_extra
              log.info("Distributing #{device_extra} to #{dev}; now #{dev.size}")
              assigned_size += device_extra
            end
            extra_size -= assigned_size
            break if assigned_size.zero? # (bsc#1063392)
          end
          log.info("Could not distribute #{extra_size}") unless extra_size.zero?
          extra_size
        end

        # Devices that may grow when distributing the extra space
        #
        # @param devices [Array<HasSize>]
        # @return [Array<HasSize>]
        def extra_space_candidates(devices)
          devices.select { |dev| dev.size < dev.max_size }
        end

        # Extra space to be assigned to a device
        #
        # @param device [Object] device (of a class including this mixin) to enlarge
        # @param total_size [DiskSize] free space to be distributed among involved devices
        # @param total_weight [Float] sum of the weights of all involved devices
        # @param assigned_size [DiskSize] space already distributed to other devices
        # @param rounding [DiskSize] size to round up
        #
        # @return [DiskSize]
        def device_extra_size(device, total_size, total_weight, assigned_size, rounding)
          available_size = total_size - assigned_size

          extra_size = total_size * (device.weight.to_f / total_weight)
          extra_size = extra_size.ceil(rounding)
          extra_size = available_size.floor(rounding) if extra_size > available_size

          new_size = device.size + extra_size
          if new_size > device.max_size
            # Increase just until reaching the max size, ensuring rounding
            (device.max_size - device.size).floor(rounding)
          else
            extra_size
          end
        end

        def distributable?(size, rounding)
          size >= rounding
        end

        def adjust_size_to_last_slot(device, space_size, align_grain)
          adjusted_size = adjusted_size_after_ceil(device, space_size, align_grain)
          device.size = adjusted_size unless adjusted_size < device.min_size
        end

        def adjusted_size_after_ceil(device, space_size, align_grain)
          mod = space_size % align_grain
          last_slot_size = mod.zero? ? align_grain : mod
          return device.size if last_slot_size == align_grain

          missing = align_grain - last_slot_size
          device.size - missing
        end

        # Total sum of all weights of the planned devices
        #
        # @return [Float]
        def total_weight(devices)
          devices.map(&:weight).reduce(0, :+)
        end

        # Checks if there are enough space at all
        # @raise RuntimeError if there is not enough space
        def check_size(devices, space_size)
          needed_size = DiskSize.sum(devices.map(&:min))
          return unless space_size < needed_size

          log.error "not enough space: needed #{needed_size}, available #{space_size}"
          raise RuntimeError
        end

        # Sets sizes of the given devices to their minimal valid value
        # @return [Array<Planned::Device>] modified devices with size adjusted to rounded minimum size
        def init_sizes(devices, rounding)
          devices.map do |device|
            new_dev = device.dup
            new_dev.size = device.min_size.ceil(rounding)
            new_dev
          end
        end
      end

      def self.included(base)
        base.extend(ClassMethods)
      end
    end
  end
end
