# frozen_string_literal: true

# Copyright (c) [2025] SUSE LLC
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

require "y2storage/storage_manager"
require "y2storage/disk_analyzer"

module Agama
  module Storage
    # Helper class for asking about the system devices.
    class System
      # @param devicegraph [Y2Storage::Devicegraph, nil] Devicegraph representing the system. Probed
      #   is used by default.
      def initialize(devicegraph = nil)
        return unless devicegraph

        @devicegraph = devicegraph
        @disk_analizer = Y2Storage::DiskAnalyzer.new(devicegraph)
      end

      # All devices that are considered as a valid target for the boot partitions and, as such, as
      # candidates for a typical installation.
      #
      # @return [Array<Y2Storage::Partitionable>]
      def candidate_devices
        candidate_drives + candidate_md_raids
      end

      # All devices that can be referenced by a drive entry at the Agama config
      #
      # This excludes devices with any mounted filesystem and devices that contain a repository
      # for installation.
      #
      # @return [Array<Y2Storage::Partitionable>]
      def available_drives
        return [] unless devicegraph

        drives = devicegraph.disk_devices + devicegraph.stray_blk_devices
        drives.select { |d| available?(d) }
      end

      # All drive devices that are considered as a valid target for the boot partitions and,
      # as such, as candidates for a typical installation.
      #
      # @return [Array<Y2Storage::Partitionable>]
      def candidate_drives
        available_drives.select { |d| analyzer.supports_boot_partitions?(d) }
      end

      # All devices that can be referenced by an mdRaid entry at the Agama config
      #
      # This excludes devices with any mounted filesystem and devices that contain a repository
      # for installation.
      #
      # @return [Array<Y2Storage::Md>]
      def available_md_raids
        return [] unless devicegraph

        devicegraph.software_raids.select { |r| available?(r) }
      end

      # All mdRaid devices that are considered as a valid target for the boot partitions and,
      # as such, as candidates for a typical installation.
      #
      # Technically, it makes no sense to consider any software RAID as a candidate. But for
      # historical reasons (check Y2Storage::DiskAnalyzer for background), YaST considers some
      # software RAIDs as candidates when booting in EFI mode.
      #
      # After checking with the involved SUSE partners, we decided Agama does not need to
      # inherit that behavior. If needed, the variable LIBSTORAGE_MDPART can still be used to
      # consider software RAIDs as BIOS-based RAIDs.
      #
      # @return [Array<Y2Storage::Md>]
      def candidate_md_raids
        available_md_raids.reject { |r| r.is?(:software_raid) }
      end

      # Whether the device is usable as drive or mdRaid
      #
      # See {#available_drives} and {#available_md_raids}
      #
      # @param device [Y2Storage::Partitionable, Y2Storage::Md]
      # @return [Boolean]
      def available?(device)
        analyzer.available_device?(device)
      end

      # Whether the device can be used for installation, including the boot partitions
      #
      # See {#candidate_drives} and {#candidate_md_raids}
      #
      # @param device [Y2Storage::Partitionable, Y2Storage::Md]
      # @return [Boolean]
      def candidate?(device)
        available?(device) && device.is?(:disk_device)
      end

      # Devicegraph representing the system.
      #
      # @return [Y2Storage::Devicegraph]
      def devicegraph
        @devicegraph || storage_manager.probed
      end

      # Analyzer of the devicegraph representing the system.
      #
      # @return [Y2Storage::DiskAnalyzer]
      def analyzer
        @disk_analyzer || storage_manager.probed_disk_analyzer
      end

    private

      # @return [Y2Storage::StorageManager]
      def storage_manager
        Y2Storage::StorageManager.instance
      end
    end
  end
end
