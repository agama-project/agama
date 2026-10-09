# Copyright (c) [2017-2020] SUSE LLC
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

require "yast"
require "installation/autoinst_profile/section_with_attributes"
require "y2storage/autoinst_profile/drive_section"

module Y2Storage
  module AutoinstProfile
    # Thin object oriented layer on top of the <partitioning> section of the
    # AutoYaST profile.
    #
    # More information can be found in the 'Partitioning' section of the AutoYaST documentation:
    # https://www.suse.com/documentation/sles-12/singlehtml/book_autoyast/book_autoyast.html#CreateProfile.Partitioning
    class PartitioningSection < ::Installation::AutoinstProfile::SectionWithAttributes
      # @return [Array<DriveSection] drives whithin the <partitioning> section
      attr_accessor :drives

      def initialize
        super() # use default nil parent

        @drives = []
      end

      # Creates an instance based on the profile representation used by the
      # AutoYaST modules (nested arrays and hashes).
      #
      # This method provides no extra validation, type conversion or
      # initialization to default values. Those responsibilities belong to the
      # AutoYaST modules. The collection of hashes is expected to be valid and
      # contain the relevant information.
      #
      # @param drives_array [Array<Hash>] content of the "partitioning" section
      #   of the main profile hash. Each element of the array represents a
      #   drive section in that profile.
      # @return [PartitioningSection]
      def self.new_from_hashes(drives_array)
        result = new
        result.drives = drives_array.each_with_object([]) do |hash, array|
          drive = DriveSection.new_from_hashes(hash, result)
          array << drive if drive
        end
        result
      end

      # Clones a system into an AutoYaST profile section, creating an instance
      # of this class from the information in a devicegraph.
      #
      # This implements the same behavior followed by the old AutoYaST
      # cloning/export, which includes some custom logic beyond the direct
      # transformation 1:1 of devices into <drive> sections. Check the
      # implementation of the different subsections for more details.
      #
      # @note The original logic used to live in AutoinstPartPlan#ReadHelper.
      #
      # @param [Devicegraph] devicegraph to clone
      # @return [PartitioningSection]
      def self.new_from_storage(devicegraph)
        result = new
        result.drives = drives_from_storage(devicegraph)

        result
      end

      # Content of the section in the format used by the AutoYaST modules
      # (nested arrays and hashes).
      #
      # @return [Array<Hash>] each element represents a <drive> section
      def to_hashes
        drives.map(&:to_hashes)
      end

      DISK_DRIVE_TYPES = [:CT_DISK, :CT_DMMULTIPATH].freeze
      private_constant :DISK_DRIVE_TYPES

      # Drive sections with type :CT_DISK
      #
      # @return [Array<DriveSection>]
      def disk_drives
        drives.select { |d| DISK_DRIVE_TYPES.include?(d.type) }
      end

      # Drive sections with type :CT_LVM
      #
      # @return [Array<DriveSection>]
      def lvm_drives
        drives.select { |d| d.type == :CT_LVM }
      end

      # Drive sections with type :CT_MD
      #
      # @return [Array<DriveSection>]
      def md_drives
        drives.select { |d| d.type == :CT_MD }
      end

      # Drive sections with type :CT_BCACHE
      #
      # @return [Array<DriveSection>]
      def bcache_drives
        drives.select { |d| d.type == :CT_BCACHE }
      end

      # Drive sections with type :CT_NFS
      #
      # @return [Array<DriveSection>]
      def nfs_drives
        drives.select { |d| d.type == :CT_NFS }
      end

      # Drive sections with type :CT_BTRFS
      #
      # @return [Array<DriveSection>]
      def btrfs_drives
        drives.select { |d| d.type == :CT_BTRFS }
      end

      # Drive sections with type :CT_TMPFS
      #
      # @return [Array<DriveSection>]
      def tmpfs_drives
        drives.select { |d| d.type == :CT_TMPFS }
      end

      # All drive sections generated from a given devicegraph
      #
      # It creates a drive section for each exportable device, see {#exportable_devices}.
      #
      # @param devicegraph [Devicegraph]
      # @return [Array<DriveSection>]
      def self.drives_from_storage(devicegraph)
        devices = exportable_devices(devicegraph)

        drives = devices.map { |d| DriveSection.new_from_storage(d) }.compact
        merge_by_type(drives, :CT_TMPFS)
      end

      # Merges drive sections of a given type into a single section
      #
      # @param drives [Array<DriveSection>] Drive sections
      # @param type [Symbol] Type to merge
      # @return [Array<DriveSection>] Drive sections containing a single section, if any, of
      #   the given type
      def self.merge_by_type(drives, type)
        by_type, others = drives.partition { |d| d.type == type }
        return others if by_type.empty?

        parts = by_type.map(&:partitions).flatten
        merged_drive = by_type.first.clone
        merged_drive.partitions = parts
        others + [merged_drive]
      end
      private_class_method :merge_by_type

      # All devices that can be exported by AutoYaST
      #
      # @param devicegraph [Devicegraph]
      # @return [Array<Device>]
      def self.exportable_devices(devicegraph)
        [].concat(
          devicegraph.bcaches,
          devicegraph.software_raids,
          devicegraph.lvm_vgs,
          devicegraph.disk_devices,
          devicegraph.stray_blk_devices,
          devicegraph.multidevice_btrfs_filesystems,
          devicegraph.nfs_mounts,
          devicegraph.tmp_filesystems
        )
      end

      private_class_method :drives_from_storage, :exportable_devices
    end
  end
end
