# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
    # A volume is used by the Agama proposal to communicate to the D-Bus layer about the
    # characteristics of a volume to create in the system. A volume only provides the meaningful
    # options from D-Bus and Agama point of views.
    #
    # The Agama proposal calculates a storage proposal with volume specifications created from the
    # volumes.
    class Volume
      # Mount path
      #
      # @return [String, nil] nil if undetermined
      attr_accessor :mount_point

      # Whether the volume is optional
      #
      # @note An optional volume is not automatically added by the storage proposal in any case.
      #   This value comes from a volume spec, see {#load_spec_values}.
      #
      # @return [Boolean]
      attr_reader :optional
      alias_method :optional?, :optional

      # Type of device
      #
      # @note This value is not transferred to the storage proposal yet.
      #
      # @return [:partition, :lvm_lv, nil] nil if undetermined
      attr_accessor :device_type

      # Whether the volume should be encrypted
      #
      # @note This value is not transferred to the storage proposal yet.
      #
      # @return [Boolean, nil] nil if undetermined
      attr_accessor :encrypted

      # Possible filesystem types for the volume
      #
      # @note This value comes from a volume spec, see {#load_spec_values}.
      #
      # @return [Array<Y2Storage::Filesystems::Type>]
      attr_reader :fs_types

      # Filesystem for the volume
      #
      # @return [Y2Storage::Filesystems::Type, nil] nil if undetermined
      attr_accessor :fs_type

      # Min size for the volume
      #
      # @return [Y2Storage::DiskSize, nil] nil if undetermined
      attr_accessor :min_size

      # Max size for the volume
      #
      # @return [Y2Storage::DiskSize, nil] nil if undetermined
      attr_accessor :max_size

      # Whether the sizes should not be automatically calculated
      #
      # @return [Boolean, nil] nil if undetermined
      attr_accessor :fixed_size_limits

      # Related volumes that may affect the calculation of the automatic size limits
      #
      # @note This is set by calling to {#assign_size_relevant_volumes} method.
      #
      # @return [Array<String>]
      attr_reader :size_relevant_volumes

      # Whether the volume is snapshots
      #
      # @return [Boolean, nil] nil if undetermined
      attr_accessor :snapshots

      # Whether snapshots option can be configured
      #
      # @note This value comes from a volume spec, see {#load_spec_values}.
      #
      # @return [Boolean]
      attr_reader :snapshots_configurable
      alias_method :snapshots_configurable?, :snapshots_configurable

      # Constructor
      #
      # The volume is populated with some of the spec values.
      #
      # @param spec [Y2Storage::VolumeSpecification, nil]
      def initialize(spec = nil)
        @optional = true
        @snapshots_configurable = false
        @fs_types = []
        @size_relevant_volumes = []

        load_spec_values(spec) if spec
      end

      # Sets the mount points that affects the sizes of the volume
      #
      # @param specs [Array<Y2Storage::VolumeSpecification>]
      def assign_size_relevant_volumes(specs)
        # FIXME: this should be a responsibility of the Proposal (since it's calculated by
        # Proposal::DevicesPlanner)
        @size_relevant_volumes = specs.select { |s| fallback?(s) }.map(&:mount_point)
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

      # Whether the mount point of the volume matches the given one
      #
      # @param path [String, nil] mount point to check
      # @return [Boolean]
      def mounted_at?(path)
        return false if mount_point.nil? || path.nil?

        Pathname.new(mount_point).cleanpath == Pathname.new(path).cleanpath
      end

    private

      # Size required for snapshots
      #
      # @return [Y2Storage::DiskSize, nil]
      attr_reader :snapshots_size

      # Percentage of space required for snapshots
      #
      # @return [Integer, nil]
      attr_reader :snapshots_percentage

      # Loads meaningful values from a given volume spec
      #
      # @param spec [Y2Storage::VolumeSpecification]
      def load_spec_values(spec)
        @mount_point = spec.mount_point
        @optional = spec.proposed_configurable?
        @min_size = spec.min_size
        @max_size = spec.max_size
        @fs_types = spec.fs_types
        @fs_type = spec.fs_type
        @snapshots = spec.snapshots?
        @snapshots_configurable = spec.snapshots_configurable?
        @snapshots_size = spec.snapshots_size
        @snapshots_percentage = spec.snapshots_percentage
        @fixed_size_limits = spec.ignore_fallback_sizes?
      end

      # Whether the given spec has the volume as fallback for sizes
      #
      # @param spec [Y2Storage::VolumeSpecification]
      # @return [Boolean]
      def fallback?(spec)
        mounted_at?(spec.fallback_for_min_size) ||
          mounted_at?(spec.fallback_for_max_size) ||
          mounted_at?(spec.fallback_for_max_size_lvm)
      end
    end
  end
end
