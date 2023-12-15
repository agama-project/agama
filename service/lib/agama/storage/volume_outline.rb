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
require "y2storage/disk_size"

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
      attr_accessor :required
      alias_method :required?, :required

      # Possible filesystem types for the volume
      #
      # @return [Array<Y2Storage::Filesystems::Type>]
      attr_accessor :filesystems

      # Base value to calculate the min size for the volume (if #auto_size is set to true
      # for that final volume)
      #
      # @return [Y2Storage::DiskSize]
      attr_accessor :base_min_size

      # Base value to calculate the max size for the volume (if #auto_size is set to true
      # for that final volume)
      #
      # @return [Y2Storage::DiskSize]
      attr_accessor :base_max_size

      # @return [Boolean]
      attr_accessor :adjust_by_ram
      alias_method :adjust_by_ram?, :adjust_by_ram

      # Lists the mount paths of the volumes for which this volume is a min size fallback.
      #
      # Being a min size fallback means that the min size of the volume would be increased by the
      # min size of other volumes, if any of that other volumes is not used for the proposal.
      #
      # For example, let's say the root volume is a fallback for the min size of /home and /var
      # (root.min_size_fallback_for => ["/home", "/var"]). And a proposal is calculated with only
      # root and /home. In that case, the min size of /var is added to the min size of root. The
      # same would happen for /home if the proposal does not include it.
      #
      # @return [Array<String>]
      attr_accessor :min_size_fallback_for

      # The same as {#min_size_fallback_for}, but for the max size of the volume.
      #
      # @return [Array<String>]
      attr_accessor :max_size_fallback_for

      # Whether snapshots option can be configured
      #
      # @return [Boolean] false by default
      attr_accessor :snapshots_configurable
      alias_method :snapshots_configurable?, :snapshots_configurable

      # Size required for snapshots
      #
      # @return [Y2Storage::DiskSize, nil] nil if no extra size for snapshots.
      attr_accessor :snapshots_size

      # Percentage of space required for snapshots
      #
      # @return [Integer, nil] nil if no extra size for snapshots.
      attr_accessor :snapshots_percentage

      def initialize
        @required = false
        @adjust_by_ram = false
        @snapshots_configurable = false
        @filesystems = []
        @base_min_size = Y2Storage::DiskSize.zero
        @base_max_size = Y2Storage::DiskSize.unlimited
        @size_relevant_volumes = []
        @max_size_fallback_for = []
        @min_size_fallback_for = []
      end

      # Related volumes that may affect the calculation of the automatic size limits
      #
      # @return [Array<String>]
      def size_relevant_volumes
        (max_size_fallback_for + min_size_fallback_for).sort.uniq
      end

      # Whether snapshots affect the automatic calculation of the size limits
      #
      # @return [Boolean]
      def snapshots_affect_sizes?
        return true if snapshots_size && !snapshots_size.zero?
        return false unless snapshots_percentage

        !snapshots_percentage.zero?
      end

      # Whether it makes sense to have automatic size limits for the volume
      #
      # @return [Boolean]
      def adaptive_sizes?
        size_relevant_volumes.any? || adjust_by_ram? || snapshots_affect_sizes?
      end
    end
  end
end
