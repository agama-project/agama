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
      # @param devicegraph [Y2Storage::Divecegraph, nil] Devicegraph representing the system. Probed
      #   is used by default.
      def initialize(devicegraph = nil)
        return unless devicegraph

        @devicegraph = devicegraph
        @disk_analizer = Y2Storage::DiskAnalyzer.new(devicegraph)
      end

      # Candidate drives for installation.
      #
      # @return [Array<Y2Storage::Drive, Y2Storage::StrayBlkDevice>]
      def candidate_drives
        return [] unless devicegraph

        drives = devicegraph.disk_devices + devicegraph.stray_blk_devices
        drives.select { |d| analyzer.candidate_device?(d) }
      end

      # Candidate MD RAIDs for installation.
      #
      # @return [Array<Y2Storage::Md]
      def candidate_md_raids
        return [] unless devicegraph

        devicegraph.md_raids.select { |d| analyzer.candidate_device?(d) }
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
