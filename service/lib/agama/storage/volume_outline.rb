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

require "pathname"

module Agama
  module Storage
    # Set of rules and features used to fully define and validate a given volume
    class VolumeOutline
      # Whether the volume is mandatory
      #
      # If this is true, the list of volumes used by the storage proposal will always contain
      # this volume or an equivalent one (ie. one with the same mount_path).
      #
      # @return [Boolean]
      attr_reader :required
      alias_method :required?, :required

      # Possible filesystem types for the volume
      #
      # @return [Array<Y2Storage::Filesystems::Type>]
      attr_reader :filesystems

      # Base value to calculate the min size for the volume (if #auto_size is set to true
      # for that final volume) or to use as default value (if #auto_size is false)
      #
      # @return [Y2Storage::DiskSize]
      attr_reader :base_min_size

      # Base value to calculate the max size for the volume (if #auto_size is set to true
      # for that final volume) or to use as default value (if #auto_size is false)
      #
      # @return [Y2Storage::DiskSize]
      attr_reader :base_max_size

      attr_reader :adjust_by_ram
      alias_method :adjust_by_ram?, :adjust_by_ram

      # @return [Array<String>] mount paths of other volumes
      attr_accessor :min_size_fallback_for

      # @return [Array<String>] mount paths of other volumes
      attr_accessor :max_size_fallback_for

      # Whether snapshots option can be configured
      #
      # @return [Boolean]
      attr_reader :snapshots_configurable
      alias_method :snapshots_configurable?, :snapshots_configurable

      # Size required for snapshots
      #
      # @return [Y2Storage::DiskSize, nil]
      attr_reader :snapshots_size

      # Percentage of space required for snapshots
      #
      # @return [Integer, nil]
      attr_reader :snapshots_percentage

      def initialize
        @filesystems = []
        @base_min_size = Y2Storage::DiskSize.zero
        @base_max_size = Y2Storage::DiskSize.Unlimited
        @size_relevant_volumes = []
        @max_size_fallback_for = []
        @min_size_fallback_for = []
      end

      # Related volumes that may affect the calculation of the automatic size limits
      #
      # @return [Array<String>]
      def size_relevant_volumes
        (max_size_fallbacks_for + min_size_fallbacks_for).sort.uniq
      end

      # Whether snapshots affect the automatic calculation of the size limits
      #
      # @param snapshots [Booelan] Whether snapshots is active
      # @return [Boolean]
      def snapshots_affect_sizes?(snapshots)
        # FIXME: this should be a responsibility of the Proposal (since it's calculated by
        # Proposal::DevicesPlanner)
        return false unless snapshots || snapshots_configurable

        return true if snapshots_size && !snapshots_size.zero?

        snapshots_percentage && !snapshots_percentage.zero?
      end
    end
  end
end
