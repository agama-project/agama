# Copyright (c) [2017] SUSE LLC
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
require "y2storage/planned/device"
require "y2storage/secret_attributes"
require "y2storage/planned/mixins"
require "y2storage/planned/partition"

module Y2Storage
  module Planned
    # Specification for Y2Storage::LvmVg object to be created during the
    # storage or AutoYaST proposals
    #
    # @see Device
    class LvmVg < Device
      include Planned::HasSize
      include SecretAttributes

      DEFAULT_EXTENT_SIZE = DiskSize.MiB(4)
      private_constant :DEFAULT_EXTENT_SIZE

      # This is just an estimation chosen to match libstorage hardcoded value
      # See LvmVg::Impl::calculate_region() in storage-ng
      USELESS_PV_SPACE = DiskSize.MiB(1)
      private_constant :USELESS_PV_SPACE

      # @return [String] name to use for Y2Storage::LvmVg#vg_name
      attr_accessor :volume_group_name

      # @return [Array<Planned::LvmLv>] List of logical volumes
      attr_accessor :lvs

      # @return [Array<String>] Name of partitions to be used as physical volumes
      attr_accessor :pvs

      # @return [DiskSize] Size of one extent
      attr_writer :extent_size

      # @return [Symbol] Policy to make space for planned volume groups:
      #   remove old logical volumes until new ones fit (:needed), remove
      #   all old logical volumes (:remove) or not remove any logical
      #   volume (:keep).
      attr_accessor :make_space_policy

      # @!attribute pvs_encryption_password
      #   @return [String, nil] password used to encrypt the newly created
      #     physical volumes. If nil, the PVs will not be encrypted.
      secret_attr :pvs_encryption_password

      # Method used to encrypt the newly created physical volumes if {#pvs_encryption_password} is set
      #
      # @return [EncryptionMethod]
      attr_accessor :pvs_encryption_method

      # Returns the encryption authentication type
      #
      # @return [EncryptionAuthentication]
      attr_accessor :pvs_encryption_authentication

      # PBKDF used to encrypt the newly created physical volumes if {#pvs_encryption_password} is set
      # and LUKS2 is used
      #
      # @return [PbkdFunction, nil] nil to use the default function
      attr_accessor :pvs_encryption_pbkdf

      # Strategy used by the guided proposal to calculate the size of the resulting
      # volume group
      #
      # @see ProposalSettings#lvm_vg_strategy
      #
      # @return [Symbol]
      attr_accessor :size_strategy

      # Disks where the proposal can create extra physical volumes to honor {#size_strategy}
      #
      # @return [Array<String>] names of partitionable devices
      attr_accessor :pvs_candidate_devices

      # Builds a new instance based on a real VG
      #
      # The new instance represents the intention to reuse the real VG, so the
      # #reuse_name method will be set accordingly. On the other hand, it copies
      # information from the real VG to make sure it is available even if the
      # real_vg object disappears.
      #
      # @param real_vg [Y2Storage::LvmVg] Volume group to base on
      # @return [LvmVg] New LvmVg instance based on real_vg
      def self.from_real_vg(real_vg)
        vg = new(volume_group_name: real_vg.vg_name)
        vg.initialize_from_real_vg(real_vg)
        vg
      end

      # Constructor
      #
      # @param volume_group_name [String] Name of the volume group
      # @param lvs               [Array<Planned::LvmLv>] List of planned logical volumes
      # @param pvs               [Array<String>] Name of partitions to be used as physical volumes
      def initialize(volume_group_name: nil, lvs: [], pvs: [])
        super()
        initialize_has_size
        @volume_group_name = volume_group_name
        @lvs = lvs
        @pvs = pvs
        @pvs_encryption_password = nil
        @make_space_policy = :needed
        @pvs_candidate_devices = []
      end

      # Initializes the object taking the values from a real volume group
      #
      # @param real_vg [Y2Storage::LvmVg] Real volume group
      def initialize_from_real_vg(real_vg)
        @extent_size = real_vg.extent_size
        @total_size = real_vg.total_size
        @pvs = real_vg.lvm_pvs.map { |v| v.blk_device.name }
        @lvs = real_vg.lvm_lvs.map { |v| LvmLv.from_real_lv(v) }
        self.reuse_name = real_vg.vg_name
      end

      # Redefines the corresponding method from the base class
      #
      # @see Device#assign_reuse
      #
      # For some reason (maybe just a historical mistake), the usage of #reuse_name is inconsistent
      # in this class compared to the rest. Instead of using the device name, it uses the volume
      # group name.
      #
      # @param device [Y2Storage::LvmVg]
      def assign_reuse(device)
        super(device)
        @reuse_name = device.vg_name
      end

      # Min size that a partition (or any other block device) must have to be useful as PV
      #
      # @return [DiskSize]
      def min_pv_size
        extent_size + useless_pv_space
      end

      # Planned partition representing an LVM physical volume with the minimum
      # possible size
      #
      # @return [Planned::Partition]
      def minimal_pv_partition
        res = Planned::Partition.new(nil)
        res.partition_id = PartitionId::LVM
        res.lvm_volume_group_name = volume_group_name
        adjust_encryption(res)
        res.min_size = min_pv_size
        res.disk = forced_disk_name
        res
      end

      # Planned partition that would be needed to provide all the necessary
      # LVM space in a single physical volume
      #
      # This method is useful to generate a volume group with just one new PV.
      #
      # @param target [DiskSize, nil] aim for the provided size, instead of
      #   trying to provide the exact size needed by the volume group
      # @return [Planned::Partition]
      def single_pv_partition(target: nil)
        pv = minimal_pv_partition
        pv.min_size = real_pv_size(target || missing_space)
        pv.max_size = real_pv_size(max_size)
        pv.weight = lvs_weight
        pv
      end

      # Part of a physical volume that can be used to allocate planned volumes
      #
      # @param size [DiskSize] total size of the partition
      # @return [DiskSize] usable size after substracting LVM overhead and
      #     space wasted by rounding
      def useful_pv_space(size)
        size -= useless_pv_space
        size.floor(extent_size)
      end

      # Total size that a partition (or other block device) must have in order to
      # provide the given useful size to the volume group. Inverse of #useful_pv_space
      # @see #useful_pv_space
      #
      # @param useful_size [DiskSize] size usable to allocate logical volumes
      # @return [DiskSize] real size of the partition
      def real_pv_size(useful_size)
        useful_size.ceil(extent_size) + useless_pv_space
      end

      # Returns the size of each extent
      #
      # @return [DiskSize]
      def extent_size
        @extent_size ||= DEFAULT_EXTENT_SIZE
      end

      # Determines the space needed to acommodate this volume group
      #
      # @return [DiskSize]
      def target_size
        DiskSize.sum(lvs.map(&:min_size), rounding: extent_size)
      end

      # Determines the space currently used by the volume group
      #
      # It will be DiskSize.zero if it does not exist yet.
      #
      # @return [DiskSize]
      def total_size
        @total_size ||= DiskSize.zero
      end

      # Return all logical volumes in the volume group
      #
      # It includes thin provisioned logical volumes.
      #
      # @return [Array<Planned::LvmLv>] List of logical volumes
      def all_lvs
        lvs + lvs.map(&:thin_lvs).flatten
      end

      # Return thin pool logical volumes
      #
      # @return [Array<Planned::LvmLv] List of thin pool logical volumes
      def thin_pool_lvs
        lvs.select { |v| v.lv_type == LvType::THIN_POOL }
      end

      # Space that must be added to the final volume group in order to make
      # possible to allocate all the LVM planned volumes.
      #
      # This method takes into account the size of the extents and all the
      # related roundings.
      #
      # If this represents a reused volume group, the method assumes all the space
      # in that volume group can be reclaimed for the guided proposal purposes.
      #
      # @return [DiskSize]
      def missing_space
        return DiskSize.zero if !lvs || lvs.empty?

        substract_reused_vg_size(target_size)
      end

      # Space that must be added to the volume group to fulfill the max size
      # requirements for all the LVM planned volumes.
      #
      # This method takes into account the size of the extents and all the
      # related roundings.
      #
      # If this represents a reused volume group, the method assumes all the space
      # in that volume group can be reclaimed for the guided proposal purposes.
      #
      # @return [DiskSize]
      def max_extra_space
        return DiskSize.zero if !lvs || lvs.empty?

        max = max_size
        return max if max.unlimited? || !reuse?

        substract_reused_vg_size(max)
      end

      def self.to_string_attrs
        [:reuse_name, :volume_group_name]
      end

      # Device name of the disk-like device in which the volume group has to be
      # physically located. If nil, the volume group can spread over a set of
      # several disks (maybe even unlimited).
      #
      # @return [String, nil]
      def forced_disk_name
        forced_lv = lvs.find(&:disk)
        return forced_lv.disk if forced_lv

        pvs_candidate_devices.size == 1 ? pvs_candidate_devices.first : nil
      end

      protected

      def device_to_reuse(devicegraph)
        return nil unless reuse?

        Y2Storage::LvmVg.find_by_vg_name(devicegraph, reuse_name)
      end

      # @see #minimal_pv_partition
      def adjust_encryption(planned_pv)
        return unless pvs_encryption_password

        planned_pv.encryption_password = pvs_encryption_password
        planned_pv.encryption_method = pvs_encryption_method
        planned_pv.encryption_authentication = pvs_encryption_authentication
        planned_pv.encryption_pbkdf = pvs_encryption_pbkdf
      end

      # Whether the created PVs should be encrypted
      #
      # @see #pvs_encryption_password
      #
      # @return [Boolean]
      def pvs_encrypt?
        !pvs_encryption_password.nil?
      end

      # Max space needed to acommodate all the LVs of this volume group
      #
      # @return [DiskSize]
      def max_size
        DiskSize.sum(lvs.map(&:max_size), rounding: extent_size)
      end

      # Total weight of all the planned LVs
      #
      # @return [Integer]
      def lvs_weight
        lvs.map { |lv| lv.weight || 0 }.reduce(:+)
      end

      # Portion of a newly created physical volume that couldn't be used to
      # allocate logical volumes because it would be reserved for LVM metadata
      # and other data structures.
      #
      # @return [DiskSize]
      def useless_pv_space
        pvs_encrypt? ? USELESS_PV_SPACE + encryption_overhead : USELESS_PV_SPACE
      end

      def substract_reused_vg_size(size)
        if total_size < size
          size - total_size
        else
          DiskSize.zero
        end
      end

      # @return [DiskSize]
      def encryption_overhead
        Planned::Partition.encryption_overhead(pvs_encryption_method&.encryption_type)
      end
    end
  end
end
