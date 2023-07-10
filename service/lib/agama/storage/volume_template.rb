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
    # Starting point to define a Volume. Each product/role will define a set of VolumeTemplates
    # to be used as a base to define the storage proposal
    class VolumeTemplate
      # Mount path
      #
      # Used to match the volume being defined with the template to use as base.
      #
      # @return [String]
      attr_accessor :mount_point

      # Whether the corresponding volume should be in the initial list of volumes created by default
      #
      # @return [Boolean]
      attr_reader :by_default
      alias_method :by_default?, :by_default

      # Whether the volume is optional
      #
      # If this is false, the list of volumes used by the storage proposal will always contain a
      # volume for this mount_path.
      #
      # @return [Boolean]
      attr_reader :optional
      alias_method :optional?, :optional

      # Default filesystem for the volume
      #
      # @return [Y2Storage::Filesystems::Type]
      attr_accessor :fs_type

      # Possible filesystem types for the volume
      #
      # @return [Array<Y2Storage::Filesystems::Type>]
      attr_reader :fs_types

      # Default values for the btrfs-related options if the volume uses Btrfs
      #
      # @return [BtrfsSettings, nil] nil if Btrfs is not one of the acceptable fs_types
      attr_accessor :btrfs

      # Default list of mount options
      #
      # @return [Array<String]
      attr_accessor :mount_options

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

      # Constructor
      def initialize(template_values)
        apply_defaults
        load_features(template_values)
      end

      def self.read(volumes_data)
        templates = volumes_data.map { |v| VolumeTemplate.new(v) }
        templates.each { |t| t.assign_size_relevant_volumes(templates) }
        templates
      end

      # Sets the mount points that affects the sizes of the volume
      def assign_size_relevant_volumes(volumes)
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

      def apply_defaults
        @by_default = true
        @optional = true
        @btrfs = BtrfsSettings.new
        @snapshots_configurable = false
        @mount_options = []
        @fs_types = []
        @base_min_size = Y2Storage::DiskSize.zero
        @base_max_size = Y2Storage::DiskSize.Unlimited
        @adjust_by_ram = false
        @fallback_for_min_size = nil
        @fallback_for_max_size = nil
        @size_relevant_volumes = []
      end

      def load_features(values)
      end

      # Whether the given volume template has this volume as fallback for sizes
      #
      # @param other [VolumeTemplate]
      # @return [Boolean]
      def fallback?(other)
        mounted_at?(spec.fallback_for_min_size) || mounted_at?(other.fallback_for_max_size)
      end
    end
  end
end
