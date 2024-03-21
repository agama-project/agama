# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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

module Agama
  module Storage
    # Settings specifying what device should be used for a given Volume and how
    class VolumeLocation
      # @see .targets
      TARGETS = [:default, :new_partition, :new_vg, :device, :filesystem].freeze
      private_constant :TARGETS

      # What to do to allocate the volume
      #
      # @return [Symbol] see {.targets}
      attr_reader :target

      # Concrete device to allocate the volume, the exact meaning depends on {#target}
      #
      # @return [String, nil]
      attr_accessor :device

      # All possible values for #target:
      #
      #   - :default new partition or logical volume in the default device
      #   - :new_partition new partition at the disk pointed by {#device}
      #   - :new_vg new LV in a new dedicated VG created at a the disk pointed  by {#device}
      #   - :device the existing block device specified by {#device} is used and reformatted
      #   - :filesystem: the existing filesystem on the device specified by {#device} is mounted
      #
      # @return [Array<Symbol>]
      def self.targets
        TARGETS
      end

      # Constructor
      def initialize
        @target = :default
      end

      # Sets the value of {#target} ensuring it is valid
      def target=(value)
        return unless TARGETS.include?(value)

        @target = value
      end

      # @return [Boolean]
      def default?
        target == :default
      end

      # Whether the chosen target implies reusing an existing device (formatting it or not)
      #
      # @return [Boolean]
      def reuse_device?
        [:device, :filesystem].include?(target)
      end
    end
  end
end
