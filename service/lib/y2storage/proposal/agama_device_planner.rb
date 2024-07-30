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

require "y2storage/planned"

module Y2Storage
  module Proposal
    # Base class used by Agama planners.
    class AgamaDevicePlanner
      # @!attribute [r] devicegraph
      #   @return [Devicegraph]
      attr_reader :devicegraph

      # @!attribute [r] issues_list
      attr_reader :issues_list

      # @param devicegraph [Devicegraph] Devicegraph to be used as starting point.
      # @param issues_list [AutoinstIssues::List] List of issues to register them.
      def initialize(devicegraph, issues_list)
        @devicegraph = devicegraph
        @issues_list = issues_list
      end

      # Planned devices according to the given settings.
      #
      # @return [Array] Array of planned devices.
      def planned_devices(_setting)
        raise NotImplementedError
      end

      private

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [#format, #mount]
      def configure_device(planned, settings)
        # TODO configure_encrypt
        configure_filesystem(planned, settings.filesystem) if settings.filesystem
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [Agama::Storage::Settings::Format]
      def configure_filesystem(planned, settings)
        planned.mount_point = settings.path
        planned.mount_by = settings.mount_by
        planned.fstab_options = settings.mount_options
        planned.mkfs_options = settings.mkfs_options
        # FIXME: Is this needed? Or #mount_options is enough?
        # planned.read_only = settings.read_only?
        planned.label = settings.label
        configure_filesystem_type(planned, settings.type) if settings.type
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [Agama::Storage::Settings::Filesystem]
      def configure_filesystem_type(planned, settings)
        planned.filesystem_type = settings.fs_type
        configure_btrfs(planned, settings.btrfs) if settings.btrfs
      end

      # @param planned [Planned::Disk, Planned::Partition]
      # @param settings [Agama::Storage::Settings::Btrfs]
      def configure_btrfs(planned, settings)
        planned.snapshots = settings.snapshots?
        planned.default_subvolume = settings.default_subvolume
        planned.subvolumes = settings.subvolumes
      end

      # @param planned [Planned::Partition]
      # @param settings [Agama::Storage::Settings::Size]
      def configure_size(planned, settings)
        planned.min_size = settings.min
        planned.max_size = settings.max
        planned.weight = 100
      end

      # @param planned [Planned::Disk]
      # @param settings [Agama::Storage::Settings::Drive]
      def configure_partitions(planned, settings)
        planned.partitions = settings.partitions.map do |partition_settings|
          planned_partition(partition_settings).tap { |p| p.disk = settings.found_device.name }
        end
      end

      # @param settings [Agama::Storage::Settings::Partition]
      # @return [Planned::Partition]
      def planned_partition(settings)
        Planned::Partition.new(nil, nil).tap do |planned|
          planned.partition_id = settings.id
          configure_device(planned, settings)
          configure_size(planned, settings.size)
        end
      end
    end
  end
end
