# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require "json"
require "y2storage/disk_size"
require "yast2/execute"

# :nodoc:
module Agama
  module AutoYaST
    # Simplified storage manager to be used by AutoInstallRules.
    #
    # The AutoYaST compatibility layer cannot use the regular StorageManager because it conflicts
    # with the one that Agama is using. The information from storage is used by the AutoInstallRules
    # module. However, it only need a little of information about the storage layout.
    #
    # This class offers a tiny fraction of the StorageManager API, but enough for AutoInstallRules
    # to work.
    class StorageManager
      attr_reader :probed

      def initialize
        @probed = nil
        @disk_analyzer = nil
      end

      # Probes the storage information.
      #
      # Relies on lsblk to get the list of disks and partitions.
      def probe
        json = Yast::Execute.locally(
          ["lsblk", "--json", "--output", "PATH,TYPE,FSTYPE,SIZE,MOUNTPOINTS", "--bytes"],
          stdout: :capture
        )
        lshw = JSON.parse(json)
        disks = lshw["blockdevices"].map do |disk|
          next if disk["type"].to_s != "disk" || disk.fetch("mountpoints", []).include?("[SWAP]")

          partitions = disk.fetch("children", []).map do |part|
            next if part.fetch("mountpoints", []).include?("[SWAP]")

            Partition.new(part["path"], part["fstype"])
          end

          disk = Disk.new(disk["path"], Y2Storage::DiskSize.new(disk["size"]), partitions)
        end.compact

        @probed = Devicegraph.new(disks)
      end

      # Returns a disk analyzer for the probed data.
      #
      # It "replaces" the original Y2Storage::DiskAnalyzer offering just what the AutoInstallRules
      # module needs.
      #
      # @return [DiskAnalyzer]
      def probed_disk_analyzer
        @disk_analyzer = DiskAnalyzer.new(@probed)
      end
    end

    # Replacement for the Y2Storage::DiskAnalyzer class.
    class DiskAnalyzer
      def initialize(probed)
        @probed = probed
      end

      # List of disks.
      #
      # @return [Array<Disk>]
      def disks
        @probed.disks
      end

      # List of Linux (non Windows) partitions.
      #
      # @return [Array<Partition>]
      def linux_partitions
        partitions.reject(&:windows?)
      end

      # List of Windows partitions.
      #
      # @return [Array<Partition>]
      def windows_partitions
        partitions.select(&:windows?)
      end

    private

      def partitions
        @probed.disks.map(&:partitions).flatten
      end
    end

    # Replacement for the Y2Storage::Devicegraph class.
    #
    # It only holds the list of disks.
    Devicegraph = Struct.new("Devicegraph", :disks)

    # Replacement for the Y2Storage::Disk class.
    #
    # It only holds the name, the size and the list of partitions.
    #
    # rubocop:disable Lint/StructNewOverride
    Disk = Struct.new("Disk", :name, :size, :partitions)
    # rubocop:enable Lint/StructNewOverride

    # Replacement for the Y2Storage::Partition class.
    #
    # It only holds the name and the type.
    class Partition
      attr_reader :name, :type

      def initialize(name, type)
        @name = name
        @type = type
      end

      # Windows values from lsblk
      WINDOWS_TYPES = ["vfat", "ntfs", "exfat", "msdos"].freeze

      # Determine whether it is a Windows partition.
      #
      # The check is quite simplistic but hopefully good enough for AutoInstallRules.
      def windows?
        WINDOWS_TYPES.include?(@type)
      end
    end
  end
end
