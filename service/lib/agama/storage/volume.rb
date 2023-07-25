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
require "agama/storage/btrfs_settings"
require "agama/storage/volume_outline"

module Agama
  module Storage
    # A volume represents the characteristics of a file system to create in the system.
    #
    # A volume is converted to D-Bus and to Y2Storage formats in order to provide the volume
    # information with the expected representation, see {VolumeConversion}.
    class Volume
      # Mount path
      #
      # @return [String]
      attr_accessor :mount_path

      # Outline of the volume
      #
      # @return [VolumeOutline]
      attr_reader :outline

      # Filesystem for the volume
      #
      # @return [Y2Storage::Filesystems::Type]
      attr_accessor :fs_type

      # Btrfs-related options
      #
      # Only relevant if #fs_type is Btrfs
      #
      # @return [BtrfsSettings]
      attr_accessor :btrfs

      # @return [Array<String>]
      attr_accessor :mount_options

      # These two would be used to locate the volume in a separate disk
      attr_accessor :device
      attr_accessor :separate_vg_name

      # Min size for the volume
      #
      # @return [Y2Storage::DiskSize]
      attr_accessor :min_size

      # Max size for the volume
      #
      # @return [Y2Storage::DiskSize]
      attr_accessor :max_size

      # Whether {#min_size} and {#max_size} should be automatically calculated by the proposal.
      #
      # If set to false, {#min_size} and {#max_size} must be handled by the proposal caller (i.e.,
      # must be explicitly set).
      #
      # It can only be true for volumes with adaptive sizes, see {#adaptive_sizes?}.
      #
      # @return [Boolean]
      attr_accessor :auto_size
      alias_method :auto_size?, :auto_size

      # @param mount_path [String]
      def initialize(mount_path)
        @mount_path = mount_path
        @mount_options = []
        @btrfs = BtrfsSettings.new
        @outline = VolumeOutline.new
      end

      # Whether it makes sense to have automatic size limits for the volume
      #
      # @return [Boolean]
      def auto_size_supported?
        # At some point, this method contained logic for ignoring outline.snapshots_affect_sizes?
        # when both btrfs.snapshots and outline.snapshots_configurable? were false. But we don't
        # need to have such a senseless scenario into account (a product that contains size rules
        # for the snapshots but does not allow to enable them).
        outline.adaptive_sizes?
      end
    end
  end
end
