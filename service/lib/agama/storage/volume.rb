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
    # A volume is used by the Agama proposal to communicate to the D-Bus layer about the
    # characteristics of a file-system to create in the system. A volume only provides the
    # meaningful options from D-Bus and Agama point of views.
    #
    # The Agama proposal calculates a storage proposal with a set of Y2Storage::VolumeSpecification
    # created from the volumes.
    class Volume
      # Mount path
      #
      # Used also to match the corresponding volume template
      #
      # @return [String]
      attr_accessor :mount_path

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
      # @return [BtrfsSettings, nil] nil if this does not represent a Btrfs file system
      attr_accessor :btrfs

      # @return [Array<String>]
      attr_accessor :mount_options

      # @return [Array<String>]
      attr_accessor :format_options

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

      # Whether {#min_size} and {#max_size} should be automatically calculated by the proposal
      # based on the attributes of the corresponding template.
      #
      # If set to false, {#min_size} and {#max_size} must be handled by the proposal caller (ie. must be
      # explicitly set).
      #
      # It can only be true for volumes with a template where VolumeTemplate#adaptative_sizes? is true.
      #
      # @return [Boolean]
      attr_accessor :auto_size
      alias_method :auto_size?, :auto_size

      # Constructor
      def initialize(values)
        apply_defaults
        load_features(values)
      end

      # Whether the mount point of the volume matches the given one
      #
      # @param path [String, nil] mount point to check
      # @return [Boolean]
      def mounted_at?(path)
        return false if mount_point.nil? || path.nil?

        Pathname.new(mount_point).cleanpath == Pathname.new(path).cleanpath
      end

      def self.read(volumes_data)
        volumes = volumes_data.map { |v| Volume.new(v) }
        volumes.each { |v| v.outline.assign_size_relevant_volumes(v, volumes) }
        volumes
      end

    private

      def apply_defaults
        @mount_options = []
        @format_options = []
        @btrfs = BtrfsSettings.new
        @outline = VolumeOutline.new
      end

      def load_features(values)
        @mount_path = values.fetch("mount", {}).fetch("path")
        # @mount_options = xxx
        # @format_options = xxx

        type_str = values.fetch("filesystem", {}).fetch("type", "ext4")
        @fs_type = Y2Storage::Filesystems::Type.find(type.downcase.to_sym)

        btrfs.load_features(values)
        outline.load_features(values)

        # TODO: part of this logic should likely be moved elsewhere (auto_size setter?)
        if outline.adaptative_sizes?
          @auto_size = true
        else
          @auto_size = false
          @min_size = outline.base_min_size
          @max_size = outline.base_max_size
        end
      end
    end
  end
end
