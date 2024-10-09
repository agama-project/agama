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

require "agama/storage/configs/boot"
require "agama/storage/config_conversions/from_json"

module Agama
  module Storage
    # Settings used to calculate an storage proposal.
    class Config
      # Boot settings.
      #
      # @return [Configs::Boot]
      attr_accessor :boot

      # @return [Array<Configs::Drive>]
      attr_accessor :drives

      # @return [Array<Configs::VolumeGroup>]
      attr_accessor :volume_groups

      # @return [Array]
      attr_accessor :md_raids

      # @return [Array]
      attr_accessor :btrfs_raids

      # @return [Array]
      attr_accessor :nfs_mounts

      def initialize
        @boot = Configs::Boot.new
        @drives = []
        @volume_groups = []
        @md_raids = []
        @btrfs_raids = []
        @nfs_mounts = []
      end

      # Name of the device that will presumably be used to boot the target system
      #
      # @return [String, nil] nil if there is no enough information to infer a possible boot disk
      def boot_device
        explicit_boot_device || implicit_boot_device
      end

      # Device used for booting the target system
      #
      # @return [String, nil] nil if no disk is explicitly chosen
      def explicit_boot_device
        return nil unless boot.configure?

        boot.device
      end

      # Device that seems to be expected to be used for booting, according to the drive definitions
      #
      # @return [String, nil] nil if the information cannot be inferred from the list of drives
      def implicit_boot_device
        # NOTE: preliminary implementation with very simplistic checks
        root_drive = drives.find do |drive|
          drive.partitions.any? { |p| p.filesystem&.root? }
        end

        root_drive&.found_device&.name
      end

      # return [Array<Configs::Partition>]
      def partitions
        drives.flat_map(&:partitions)
      end

      # return [Array<Configs::LogicalVolume>]
      def logical_volumes
        volume_groups.flat_map(&:logical_volumes)
      end
    end
  end
end
