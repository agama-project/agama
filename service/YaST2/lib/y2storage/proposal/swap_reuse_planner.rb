# Copyright (c) [2016-2024] SUSE LLC
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
  module Proposal
    # Class to adjust a given list of planned devices in order to reuse an existing
    # swap if possible instead of creating a new one
    class SwapReusePlanner
      include Yast::Logger

      # Constructor
      #
      # @param settings [ProposalSettings]
      # @param devicegraph [Devicegraph]
      def initialize(settings, devicegraph)
        @settings = settings
        @devicegraph = devicegraph
      end

      # Modifies the given list of planned devices configuring the planned swap (if any) to reuse
      # the existing swap if that's possible
      #
      # @param planned_devices [Array<Planned::Device>]
      def adjust_devices(planned_devices)
        planned_devices.each do |dev|
          next unless swap?(dev)

          adjust_swap(dev)
        end
      end

      protected

      # Settings used to calculate the planned devices
      # @return [ProposalSettings]
      attr_accessor :settings

      # @return [Devicegraph]
      attr_reader :devicegraph

      # Whether it makes sense to try to reuse existing swap partitions
      #
      # @return [Boolean]
      def try_to_reuse_swap?
        !settings.use_lvm && !settings.use_encryption && settings.swap_reuse != :none
      end

      # Whether the given planned device corresponds to a swap
      #
      # @param planned [Planned::Device]
      def swap?(planned)
        planned.respond_to?(:swap?) && planned.swap?
      end

      # Adjusts values when planned device is swap
      #
      # @param planned_device [Planned::Device]
      def adjust_swap(planned_device)
        return unless planned_device.is_a?(Planned::Partition)

        reuse = reusable_swap(planned_device.min_size)
        return unless reuse

        planned_device.assign_reuse(reuse)
        log.info "planned to reuse swap #{reuse.name}"
      end

      # Swap partition that can be reused.
      #
      # It returns the smaller partition that is big enough for our purposes.
      #
      # @param required_size [DiskSize]
      # @return [Partition]
      def reusable_swap(required_size)
        return nil unless try_to_reuse_swap?

        partitions = available_swap_partitions
        partitions.select! { |part| can_be_reused?(part, required_size) }
        # Use #name in case of #size tie to provide stable sorting
        partitions.min_by { |part| [part.size, part.name] }
      end

      # Returns all available and acceptable swap partitions
      #
      # @return [Array<Partition>]
      def available_swap_partitions
        devicegraph.partitions.select(&:swap?)
      end

      # Whether it is acceptable to reuse the given swap partition
      #
      # @param partition [Partition]
      # @param required_size [DiskSize]
      # @return [Boolean]
      def can_be_reused?(partition, required_size)
        return false if partition.size < required_size
        return true unless settings.swap_reuse == :candidate

        settings.candidate_devices.include?(partition.partitionable.name)
      end
    end
  end
end
