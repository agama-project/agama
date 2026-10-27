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

require "y2storage/proposal/partitions_distribution_calculator"
require "y2storage/proposal/partition_creator"
require "y2storage/proposal/autoinst_partition_size"
require "y2storage/proposal/autoinst_partitioner"
require "y2storage/proposal/autoinst_md_creator"
require "y2storage/proposal/autoinst_bcache_creator"
require "y2storage/proposal/lvm_creator"
require "y2storage/proposal/btrfs_creator"
require "y2storage/proposal/nfs_creator"
require "y2storage/proposal/tmpfs_creator"
require "y2storage/proposal/autoinst_creator_result"
require "y2storage/exceptions"

module Y2Storage
  module Proposal
    # Class to create and reuse devices during the AutoYaST proposal, based
    # on the information contained in the profile.
    #
    # ## Comparison with the guided proposal
    #
    # This class receives a devicegraph in which the previous devices have
    # already been deleted or resized according to the AutoYaST profile. This
    # is different from the guided setup equivalent step, in which the minimal
    # amount of existing devices are deleted/resized on demand while trying to
    # allocate the planned devices.
    #
    # ## Reducing planned devices when there is not enough space
    #
    # Another key difference with the guided proposal is that, when there is
    # not enough space (for partitions or logical volumes), it will do a second
    # attempt reducing all planned devices proportionally. In order to do so,
    # it will remove the min_size limit (setting it to just 1 byte) and,
    # additionally, it will set a proportional weight for every partition (see
    # {AutoinstPartitionSize#flexible_partitions}).
    #
    # Although this approach may not produce the optimal results, it is less
    # intrusive and easier to maintain than other alternatives. Bear in mind
    # that AutoYaST does not expect complex scenarios (like multiple disks with
    # several gaps), so the result should be good enough.
    #
    # If we were aiming for the optimal devices distribution, we should look at
    # {Y2Storage::Planned::PartitionsDistribution#assigned_space} and follow
    # the same approach (reducing min_size and setting a proportional weight)
    # when it is not possible to place the devices in the given free space. But
    # we would also need to do further changes, like skipping some checks when
    # running in this flexible mode.
    #
    # FIXME: class too long, refactoring needed.
    class AutoinstDevicesCreator # rubocop:disable Metrics/ClassLength
      include Yast::Logger
      include AutoinstPartitionSize

      # @return [AutoinstIssues::List] List of found AutoYaST issues
      attr_reader :issues_list

      # Constructor
      #
      # @param original_graph [Devicegraph] Devicegraph to be used as starting point
      # @param issues_list [AutoinstIssues::List] List of AutoYaST issues to register the problems
      #    found during devices creation
      def initialize(original_graph, issues_list)
        @original_graph = original_graph
        @issues_list = issues_list
      end

      # Devicegraph including all the specified planned devices
      #
      # @param planned_devices [Planned::DevicesCollection] Devices to create/reuse
      # @param disk_names [Array<String>] Disks to consider
      #
      # @return [AutoinstCreatorResult] Result with new devicegraph in which all the
      #   planned devices have been allocated
      def populated_devicegraph(planned_devices, disk_names)
        # Process planned partitions
        log.info "planned devices = #{planned_devices.to_a.inspect}"
        log.info "disk names = #{disk_names.inspect}"

        reset

        @planned_devices = planned_devices
        @disk_names = disk_names

        process_devices
      end

      protected

      # @return [Devicegraph] Original devicegraph
      attr_reader :original_graph

      # @return [Planned::DevicesCollection] Devices to create/reuse
      attr_reader :planned_devices

      # @return [Array<String>] Disks to consider
      attr_reader :disk_names

      # @return [Array<Planned::Device>] Devices to create
      attr_reader :devices_to_create

      # @return [Array<Planned::Device>] Devices to reuse
      attr_reader :devices_to_reuse

      # @return [Proposal::CreatorResult] Current result containing the devices that have been created
      attr_reader :creator_result

      # @return [Devicegraph] Current devicegraph
      attr_reader :devicegraph

      private

      # Sets the current creator result
      #
      # The current devicegraph is properly updated.
      #
      # @param result [Proposal::CreatorResult]
      def creator_result=(result)
        @creator_result = result
        @devicegraph = result.devicegraph
      end

      # Adds devices to the list of devices to create
      #
      # @param planned_devices [Array<Planned::Device>]
      def add_devices_to_create(planned_devices)
        @devices_to_create.concat(planned_devices)
      end

      # Adds devices to the list of devices to reuse
      #
      # @param planned_devices [Array<Planned::Device>]
      def add_devices_to_reuse(planned_devices)
        @devices_to_reuse.concat(planned_devices)
      end

      # Resets values before create devices
      #
      # @see #populated_devicegraph
      def reset
        @devices_to_create = []
        @devices_to_reuse = []
        @creator_result = nil
        @devicegraph = original_graph.duplicate
      end

      # Reuses and creates planned devices
      #
      # @return [AutoinstCreatorResult] Result with new devicegraph in which all the
      #   planned devices have been allocated
      def process_devices
        process_partitions
        # Process planned disk like devices (Xen virtual partitions and full disks)
        process_disk_like_devs
        process_mds
        process_vgs
        process_bcaches
        process_btrfs_filesystems
        process_nfs_filesystems
        process_tmpfs_filesystems

        Y2Storage::Proposal::AutoinstCreatorResult.new(creator_result, devices_to_create)
      end

      # Process planned partitions
      def process_partitions
        planned_partitions = planned_devices.disk_partitions
        planned_partitions = sized_partitions(planned_partitions, devicegraph: original_graph)
        parts_to_reuse, parts_to_create = planned_partitions.partition(&:reuse?)
        AutoinstPartitioner.new(devicegraph).reuse_partitions(parts_to_reuse)

        add_devices_to_create(parts_to_create)
        add_devices_to_reuse(parts_to_reuse)
        self.creator_result = create_partitions(parts_to_create, devicegraph)
      end

      # Formats and/or mounts the disk like block devices (Xen virtual partitions and full disks)
      #
      # Add planned disk like devices to reuse list so they can be considered for lvm and raids
      # later on.
      def process_disk_like_devs
        planned_devs = planned_devices.select do |dev|
          dev.is_a?(Planned::StrayBlkDevice) || dev.is_a?(Planned::Disk)
        end

        planned_devs.each { |d| d.reuse!(devicegraph) }

        add_devices_to_reuse(planned_devs)
      end

      # Process planned Mds
      def process_mds
        mds_to_reuse, mds_to_create = planned_devices.mds.partition(&:reuse?)
        devs_to_reuse_in_md = reusable_by_md(devices_to_reuse)
        reuse_partitionables(mds_to_reuse)

        add_devices_to_create(mds_to_create)
        add_devices_to_reuse(mds_to_reuse.flat_map(&:partitions))
        self.creator_result = create_mds(planned_devices.mds, devs_to_reuse_in_md)
      end

      # Process planned bcaches
      def process_bcaches
        bcaches_to_reuse, bcaches_to_create = planned_devices.bcaches.partition(&:reuse?)
        reuse_partitionables(bcaches_to_reuse)

        add_devices_to_create(bcaches_to_create)
        add_devices_to_reuse(bcaches_to_reuse.flat_map(&:partitions))
        self.creator_result = create_bcaches(planned_devices.bcaches, devices_to_reuse)
      end

      # Process planned Vgs
      def process_vgs
        planned_vgs = planned_devices.vgs
        vgs_to_reuse = planned_vgs.select(&:reuse?)
        reuse_vgs(vgs_to_reuse)

        add_devices_to_create(planned_vgs)
        add_devices_to_reuse(vgs_to_reuse.flat_map(&:lvs))
        self.creator_result = set_up_lvm(planned_vgs, devices_to_reuse)
      end

      # Process planned Btrfs filesystems
      def process_btrfs_filesystems
        filesystems_to_reuse = planned_devices.btrfs_filesystems.select(&:reuse?)
        filesystems_to_create = planned_devices.btrfs_filesystems.reject(&:reuse?)

        reuse_btrfs_filesystems(filesystems_to_reuse)

        add_devices_to_create(filesystems_to_create)

        reusable_devices = reusable_by_btrfs(devices_to_reuse)

        self.creator_result = create_btrfs_filesystems(filesystems_to_create, reusable_devices)
      end

      # Process planned NFS filesystems
      def process_nfs_filesystems
        add_devices_to_create(planned_devices.nfs_filesystems)
        self.creator_result = create_nfs_filesystems(planned_devices.nfs_filesystems)
      end

      # Process planned Tmpfs filesystems
      def process_tmpfs_filesystems
        add_devices_to_create(planned_devices.tmpfs_filesystems)
        self.creator_result = create_tmpfs_filesystems(planned_devices.tmpfs_filesystems)
      end

      # Reuses a partitionable device
      #
      # @param reused_devices [Array<Planned::Device>] MD RAIDs or bcache to reuse
      def reuse_partitionables(reused_devices)
        reused_devices.each_with_object(creator_result) do |dev, result|
          partitioner = AutoinstPartitioner.new(result.devicegraph)
          result.merge!(partitioner.reuse_device_partitions(dev))
        end
      end

      # Reuses volume groups
      #
      # @param reused_vgs [Array<Planned::LvmVg>] Volume groups to reuse
      def reuse_vgs(reused_vgs)
        reused_vgs.each_with_object(creator_result) do |vg, result|
          lvm_creator = Proposal::LvmCreator.new(result.devicegraph)
          result.merge!(lvm_creator.reuse_volumes(vg))
        end
      end

      # Reuses Btrfs filesystems
      #
      # @param filesystems_to_reuse [Array<Planned::Btrfs>]
      def reuse_btrfs_filesystems(filesystems_to_reuse)
        filesystems_to_reuse.each_with_object(creator_result) do |fs, result|
          btrfs_creator = Proposal::BtrfsCreator.new(result.devicegraph)
          result.merge!(btrfs_creator.reuse_filesystem(fs))
        end
      end

      # Creates planned partitions
      #
      # @param new_partitions [Array<Planned::Partition>] Devices to create
      # @return [PartitionCreatorResult]
      def create_partitions(new_partitions, devicegraph)
        disks = devicegraph.disk_devices.select { |d| disk_names.include?(d.name) }
        partitioner = AutoinstPartitioner.new(devicegraph)
        partitioner.create_partitions(new_partitions, disks)
      end

      # Creates MD RAID devices
      #
      # @param mds [Array<Planned::Md>] List of planned MD arrays to create
      # @param devs_to_reuse [Array<Planned::Device>] List of devices to reuse as MD device
      #
      # @return [Proposal::CreatorResult] Result containing the specified MD RAIDs
      def create_mds(mds, devs_to_reuse)
        mds.reduce(creator_result) do |result, md|
          # Normally, the profile will use the same naming convention
          # (/dev/md0 vs /dev/md/0) to define the RAID itself (in its corresponding
          # <drive> section) and to reference that RAID from its components
          # (using <raid_name>). So populating the 'devices' list below could be
          # as simple as matching Planned::Devices#raid_name with Planned::Md.name
          #
          # BUT if the old format is used to specify the RAID ("/dev/md" as name
          # and a <partition_nr> to indicate the number), the name for the planned MD
          # is auto-generated (with the /dev/md/0 format so far), so we must use
          # Planned::Md#name? to ensure robust comparison no matter which format
          # is used in #raid_name
          devices = result.created_names { |d| d.respond_to?(:raid_name) && md.name?(d.raid_name) }
          devices += devs_to_reuse.select { |d| md.name?(d.raid_name) }.map(&:reuse_name)
          if devices.empty?
            issues_list.add(Y2Storage::AutoinstIssues::NoComponents, md)
            next result
          end

          result.merge(create_md(result.devicegraph, md, devices))
        end
      end

      # Creates bcaches
      #
      # @param bcaches [Array<Planned::Bcache>] List of planned Bcache devices to create
      # @param devs_to_reuse [Array<Planned::Device>] List of devices to reuse as backing or caching
      #   device
      #
      # @return [Proposal::CreatorResult] Result containing the specified Bcache devices
      def create_bcaches(bcaches, devs_to_reuse)
        bcaches.reduce(creator_result) do |result, bcache|
          backing_devname = find_bcache_member(bcache.name, :backing, creator_result, devs_to_reuse)
          caching_devname = find_bcache_member(bcache.name, :caching, creator_result, devs_to_reuse)
          if backing_devname.nil?
            issues_list.add(Y2Storage::AutoinstIssues::NoComponents, bcache)
            next result
          end

          new_result = create_bcache(result.devicegraph, bcache, backing_devname, caching_devname)
          result.merge(new_result)
        end
      end

      # Creates volume groups
      #
      # @param vgs [Array<Planned::LvmVg>] List of planned volume groups to add
      # @param devs_to_reuse [Array<Planned::Device>] List of devices to reuse as Physical Volumes
      #
      # @return [Proposal::CreatorResult] Result containing the specified volume groups
      def set_up_lvm(vgs, devs_to_reuse)
        # log separately to be more readable
        log.info "set_up_lvm: vgs=#{vgs.inspect}"
        log.info "set_up_lvm: previous_result=#{creator_result.inspect}"
        log.info "set_up_lvm: devs_to_reuse=#{devs_to_reuse.inspect}"

        vgs.reduce(creator_result) do |result, vg|
          pvs = creator_result.created_names { |d| d.pv_for?(vg.volume_group_name) }
          devs = devs_to_reuse.select { |d| d.respond_to?(:pv_for?) && d.pv_for?(vg.volume_group_name) }
          pvs += devs.map(&:reuse_name)
          if pvs.empty?
            issues_list.add(Y2Storage::AutoinstIssues::NoComponents, vg)
            next result
          end

          result.merge(create_logical_volumes(result.devicegraph, vg, pvs))
        end
      end

      # Creates Btrfs filesystems
      #
      # @param filesystems_to_create [Array<Planned::Btrfs>]
      # @param reusable_devices [Array<Planned::Device>] devices that can be reused for the new Btrfs
      #
      # @return [Proposal::CreatorResult] Result containing the specified Btrfs filesystems
      def create_btrfs_filesystems(filesystems_to_create, reusable_devices)
        filesystems_to_create.reduce(creator_result) do |result, planned_filesystem|
          devices = created_devices_for_btrfs(planned_filesystem, result)
          devices += reused_devices_for_btrfs(planned_filesystem, reusable_devices)
          if devices.empty?
            issues_list.add(Y2Storage::AutoinstIssues::NoComponents, planned_filesystem)
            next result
          end

          result.merge(create_btrfs(result.devicegraph, planned_filesystem, devices))
        end
      end

      # Name of devices that have been created for a specific planned Btrfs
      #
      # @param planned_filesystem [Planned::Btrfs]
      # @param creator_result [Proposal::CreatorResult]
      #
      # @return [Array<String>] devices names
      def created_devices_for_btrfs(planned_filesystem, creator_result)
        creator_result.created_names do |device|
          device.respond_to?(:btrfs_name) && device.btrfs_name == planned_filesystem.name
        end
      end

      # Name of devices that can be reused for a specific planned Btrfs
      #
      # @param planned_filesystem [Planned::Btrfs]
      # @param reusable_devices [Array<Planned::Device>]
      #
      # @return [Array<String>] devices names
      def reused_devices_for_btrfs(planned_filesystem, reusable_devices)
        devices = reusable_devices.select { |d| d.btrfs_name == planned_filesystem.name }

        devices.map(&:reuse_name)
      end

      # Creates NFS filesystems
      #
      # @param nfs_filesystems [Array<Planned::Nfs>] List of planned NFS filesystems
      # @return [Proposal::CreatorResult] Result containing the specified NFS filesystems
      def create_nfs_filesystems(nfs_filesystems)
        nfs_filesystems.reduce(creator_result) do |result, planned_nfs|
          new_result = create_nfs_filesystem(result.devicegraph, planned_nfs)
          result.merge(new_result)
        end
      end

      # Creates Tmpfs filesystems
      #
      # @param tmpfs_filesystems [Array<Planned::Tmpfs>] List of planned Tmpfs filesystems
      # @return [Proposal::CreatorResult] Result containing the specified Tmpfs filesystems
      def create_tmpfs_filesystems(tmpfs_filesystems)
        tmpfs_filesystems.reduce(creator_result) do |result, planned_tmpfs|
          new_result = create_tmpfs_filesystem(result.devicegraph, planned_tmpfs)
          result.merge(new_result)
        end
      end

      # Creates a MD RAID in the given devicegraph
      #
      # @param devicegraph [Devicegraph] Starting devicegraph
      # @param md          [Planned::Md] Planned MD RAID
      # @param devices     [Array<Planned::Device>] List of devices to include in the RAID
      # @return            [Proposal::CreatorResult] Result containing the specified RAID
      #
      # @raise NoDiskSpaceError
      def create_md(devicegraph, md, devices)
        md_creator = Proposal::AutoinstMdCreator.new(devicegraph)
        md_creator.create_md(md, devices)
      end

      # Creates a bcache in the given devicegraph
      #
      # @param devicegraph     [Devicegraph] Starting devicegraph
      # @param bcache          [Planned::Bcache] Planned bcache
      # @param backing_devname [String, nil] Backing device name
      # @param caching_devname [String, nil] Caching device name
      # @return [Proposal::CreatorResult] Result containing the specified bcache
      def create_bcache(devicegraph, bcache, backing_devname, caching_devname)
        if backing_devname.nil?
          raise Y2Storage::DeviceNotFoundError, "No backing device for Bcache #{bcache.name}"
        end

        bcache_creator = Proposal::AutoinstBcacheCreator.new(devicegraph)
        bcache_creator.create_bcache(bcache, backing_devname, caching_devname)
      end

      # Creates a volume group in the given devicegraph
      #
      # @param devicegraph [Devicegraph]             Starting devicegraph
      # @param vg          [Planned::LvmVg]          Volume group
      # @param pvs         [Array<String>]           List of device names of the physical volumes
      # @return            [Proposal::CreatorResult] Result containing the specified volume group
      def create_logical_volumes(devicegraph, vg, pvs)
        lvm_creator = Proposal::LvmCreator.new(devicegraph)
        lvm_creator.create_volumes(vg, pvs)
      rescue RuntimeError => e
        log.error e.message
        lvm_creator = Proposal::LvmCreator.new(devicegraph)
        new_vg = vg.clone
        new_vg.lvs = flexible_partitions(vg.lvs)
        lvm_creator.create_volumes(new_vg, pvs)
      end

      # Creates a multi-device Btrfs filesystem in the given devicegraph
      #
      # @param devicegraph [Devicegraph] Starting devicegraph
      # @param planned_filesystem [Planned::Btrfs]
      # @param devices [Array<Planned::Device>] devices to include in the Btrfs
      #
      # @return [Proposal::CreatorResult] Result containing the specified multi-device Btrfs
      def create_btrfs(devicegraph, planned_filesystem, devices)
        btrfs_creator = Proposal::BtrfsCreator.new(devicegraph)
        btrfs_creator.create_filesystem(planned_filesystem, devices)
      end

      # Creates a NFS filesystem in the given devicegraph
      #
      # @param devicegraph [Devicegraph] Starting devicegraph
      # @param planned_nfs [Planned::Nfs]
      #
      # @return [Proposal::CreatorResult] Result containing the specified NFS
      def create_nfs_filesystem(devicegraph, planned_nfs)
        nfs_creator = Proposal::NfsCreator.new(devicegraph)
        nfs_creator.create_nfs(planned_nfs)
      end

      # Creates a Tmpfs filesystem in the given devicegraph
      #
      # @param devicegraph [Devicegraph] Starting devicegraph
      # @param planned_tmpfs [Planned::Tmpfs]
      #
      # @return [Proposal::CreatorResult] Result containing the specified Tmpfs
      def create_tmpfs_filesystem(devicegraph, planned_tmpfs)
        tmpfs_creator = Proposal::TmpfsCreator.new(devicegraph)
        tmpfs_creator.create_tmpfs(planned_tmpfs)
      end

      # Finds the Bcache member in the previous result and in the list of devices to use
      #
      # @return [String, nil] nil if no device is found
      def find_bcache_member(bcache_name, role, result, devs_to_reuse)
        names = result.created_names { |d| bcache_member_for?(d, bcache_name, role) }
        return names.first unless names.empty?

        device = devs_to_reuse.find { |d| bcache_member_for?(d, bcache_name, role) }
        device&.reuse_name
      end

      # Determines whether a device plays a given role in a bcache
      #
      # @param device      [Planned::Device] Device to consider
      # @param bcache_name [String] bcache name
      # @param role        [:caching, :backing] Role that the device plays in the bcache device
      # @return [Boolean]
      def bcache_member_for?(device, bcache_name, role)
        query_method = "bcache_#{role}_for?"
        device.respond_to?(query_method) && device.send(query_method, bcache_name)
      end

      # Return devices which can be reused by an MD RAID
      #
      # @param planned_devices [Planned::DevicesCollection] collection of planned devices
      # @return [Array<Planned::Device>]
      def reusable_by_md(planned_devices)
        planned_devices.select { |d| d.respond_to?(:raid_name) }
      end

      # Return devices which can be reused by a bcache
      #
      # @param planned_devices [Planned::DevicesCollection] collection of planned devices
      # @return [Array<Planned::Device>]
      def reusable_by_bcache(planned_devices)
        planned_devices.select { |d| d.respond_to?(:bcache_backing_for) }
      end

      # Return devices which can be reused by a Btrfs filesystem
      #
      # @param planned_devices [Planned::DevicesCollection] collection of planned devices
      # @return [Array<Planned::Device>]
      def reusable_by_btrfs(planned_devices)
        planned_devices.select { |d| d.respond_to?(:btrfs_name) }
      end
    end
  end
end
