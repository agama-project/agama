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
      # Whether the volume is optional
      #
      # If this is false, the list of volumes used by the storage proposal will always contain a
      # this volume or an equivalent one (ie. one with the same mount_path).
      #
      # @return [Boolean]
      attr_reader :optional
      alias_method :optional?, :optional

      # Possible filesystem types for the volume
      #
      # @return [Array<Y2Storage::Filesystems::Type>]
      attr_reader :fs_types

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

      # Related volumes that may affect the calculation of the automatic size limits
      #
      # @note This is set by calling to {#assign_size_relevant_volumes} method.
      #
      # @return [Array<String>]
      attr_reader :size_relevant_volumes

      attr_reader :adjust_by_ram
      alias_method :adjust_by_ram?, :adjust_by_ram

      # @return [String] mount point of another volume
      attr_accessor :fallback_for_min_size

      # @return [String] mount point of another volume
      attr_accessor :fallback_for_max_size

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
        @optional = false
        @fs_types = []
        @base_min_size = Y2Storage::DiskSize.zero
        @base_max_size = Y2Storage::DiskSize.Unlimited
        @size_relevant_volumes = []
        @adjust_by_ram = false
        @fallback_for_max_size = ""
        @fallback_for_min_size = ""
        @snapshots_configurable = false
      end

      def load_features(values)
        size = values.fetch("size", {})
        min = size["min"]
        max = size["max"]
        @base_min_size = DiskSize.parse(min, legacy_units: true) if min
        @base_max_size = DiskSize.parse(max, legacy_units: true) if max

        # @optional
        # @fs_types
        # @adjust_by_ram
        # @fallback_for_max_size
        # @fallback_for_min_size
        # @snapshots_configurable
        # @snapshots_size
        # @snapshots_percentage
      end

      # Sets the mount points that affects the sizes of the volume
      def assign_size_relevant_volumes(volume, other_volumes)
        # FIXME: this should be a responsibility of the Proposal (since it's calculated by
        # Proposal::DevicesPlanner)
        @size_relevant_volumes = other_volumes.select { |v| fallback?(volume, v) }.map(&:mount_path)
      end

      # Whether it makes sense to have automatic size limits for the volume
      #
      # @return [Boolean]
      def adaptive_sizes?
        # FIXME: this should be a responsibility of the Proposal (since it's calculated by
        # Proposal::DevicesPlanner)
        snapshots_affect_sizes? || size_relevant_volumes.any?
      end

      # Whether snapshots affect the automatic calculation of the size limits
      #
      # @return [Boolean]
      def snapshots_affect_sizes?
        # FIXME: this should be a responsibility of the Proposal (since it's calculated by
        # Proposal::DevicesPlanner)
        return false unless snapshots || snapshots_configurable

        return true if snapshots_size && !snapshots_size.zero?

        snapshots_percentage && !snapshots_percentage.zero?
      end

    private

      # Whether the given volume outline has this volume as fallback for sizes
      #
      # @param volume [Volume] the volume of this outline
      # @param other [Volume]
      # @return [Boolean]
      def fallback?(volume, other)
        volume.mounted_at?(other.outline.fallback_for_min_size) ||
          volume.mounted_at?(other.outline.fallback_for_max_size)
      end
    end
  end
end
