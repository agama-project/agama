# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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

require "forwardable"
require "json"
require "y2storage/disk_size"
require "agama/storage/btrfs_settings"
require "agama/storage/volume_conversions"
require "agama/storage/volume_location"
require "agama/storage/volume_outline"

module Agama
  module Storage
    # A volume represents the characteristics of a file system to create in the system.
    #
    # A volume is converted to D-Bus and to Y2Storage formats in order to provide the volume
    # information with the expected representation, see {VolumeConversion}.
    class Volume
      extend Forwardable

      # Mount path
      #
      # @return [String]
      attr_accessor :mount_path

      # Outline of the volume
      #
      # @return [VolumeOutline]
      attr_accessor :outline

      # Filesystem for the volume
      #
      # @return [Y2Storage::Filesystems::Type, nil]
      attr_accessor :fs_type

      # Btrfs-related options
      #
      # Only relevant if #fs_type is Btrfs
      #
      # @return [BtrfsSettings]
      attr_accessor :btrfs

      # @return [Array<String>]
      attr_accessor :mount_options

      # Location of the volume
      #
      # @return [VolumeLocation]
      attr_accessor :location

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
      # It can only be true if auto size is supported, see {auto_size_supported?}.
      #
      # @return [Boolean]
      attr_accessor :auto_size
      alias_method :auto_size?, :auto_size

      # @param mount_path [String]
      def initialize(mount_path)
        @mount_path = mount_path
        @mount_options = []
        @auto_size = false
        @min_size = Y2Storage::DiskSize.zero
        @max_size = Y2Storage::DiskSize.unlimited
        @btrfs = BtrfsSettings.new
        @outline = VolumeOutline.new
        @location = VolumeLocation.new
      end

      def_delegators :outline,
        :min_size_fallback_for, :min_size_fallback_for=,
        :max_size_fallback_for, :max_size_fallback_for=

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

      # Creates a new volume object from a JSON hash according to schema.
      #
      # @param volume_json [Hash]
      # @param config [Config]
      #
      # @return [Volume]
      def self.new_from_json(volume_json, config:)
        Storage::VolumeConversions::FromJSON.new(volume_json, config: config).convert
      end

      # Generates a JSON hash according to schema.
      #
      # @return [Hash]
      def to_json_settings
        Storage::VolumeConversions::ToJSON.new(self).convert
      end
    end
  end
end
