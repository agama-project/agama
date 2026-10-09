# Copyright (c) [2015] SUSE LLC
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

require "fileutils"
require "y2storage/disk_size"
require "y2storage/exceptions"
require "y2storage/planned/lvm_vg"

module Y2Storage
  module Proposal
    # Class to encapsulate the calculation of all the LVM-related values and
    # to generate the LVM setup needed to allocate a set of planned volumes
    class LvmHelper
      # Default name for volume groups
      DEFAULT_VG_NAME = "system".freeze

      private_constant :DEFAULT_VG_NAME

      # Constructor
      #
      # @param planned_lvs [Array<Planned::LvmLv>] volumes to allocate in LVM
      # @param settings [ProposalSettings]
      def initialize(planned_lvs, settings)
        @planned_lvs = planned_lvs
        @settings = settings
      end

      # Strategy to calculate the proposed volume group
      #
      # @see ProposalSettings#lvm_vg_strategy
      #
      # @return [Symbol]
      def vg_strategy
        settings.lvm_vg_strategy
      end

      # Returns a copy of the original devicegraph in which all the logical
      # volumes (and the volume group, if needed) have been created.
      #
      # @param original_graph [Devicegraph]
      # @param pv_partitions [Array<String>] names of the newly created
      #     partitions that should be added as PVs to the volume group
      # @return [Devicegraph]
      def create_volumes(original_graph, pv_partitions = [])
        return original_graph.duplicate if planned_lvs.empty?

        lvm_creator = LvmCreator.new(original_graph)
        lvm_creator.create_volumes(volume_group, pv_partitions).devicegraph
      end

      # Device names of the initial physical volumes of the volume group to be
      # reused (see #volume_group)
      #
      # @return [Array<String>]
      def partitions_in_vg
        volume_group.pvs
      end

      # Volumes groups that could be reused by the proposal, sorted by
      # preference.
      #
      # @param devicegraph [Devicegraph]
      # @return [Array<LvmVg>]
      def reusable_volume_groups(devicegraph)
        return [] unless try_to_reuse?

        vgs = devicegraph.lvm_vgs
        big_vgs, small_vgs = vgs.partition { |vg| vg.total_size >= volume_group.target_size }
        # Use #vg_name to ensure stable sorting
        big_vgs.sort_by! { |vg| [vg.total_size, vg.vg_name] }
        small_vgs.sort_by! { |vg| [vg.total_size, vg.vg_name] }
        small_vgs.reverse!
        big_vgs + small_vgs
      end

      # Sets the volume group to be reused
      #
      # Setting vg to nil means that no volume group will be reused.
      #
      # @param vg [LvmVg,nil] Volume group to reuse
      #
      # @see volume_group
      def reused_volume_group=(vg)
        # Invalidate cached value
        @volume_group = nil

        @reused_volume_group = nil
        return if vg.nil?

        @reused_volume_group = Y2Storage::Planned::LvmVg.from_real_vg(vg)
        @reused_volume_group.lvs = planned_lvs
        @reused_volume_group.size_strategy = vg_strategy
        @reused_volume_group.pvs_encryption_password = settings.encryption_password
        @reused_volume_group.pvs_encryption_method = settings.encryption_method
        @reused_volume_group.pvs_encryption_pbkdf = settings.encryption_pbkdf
        @reused_volume_group.pvs_encryption_authentication = settings.encryption_authentication
      end

      # Returns the planned volume group
      #
      # If no volume group is set (see {#reused_volume_group=}), it will create
      # a new one adding planned logical volumes ({#initialize}).
      #
      # @return [Planned::LvmVg] Volume group that will be used to allocate
      #   the proposed volumes, deleting the existing logical volumes if necessary
      def volume_group
        @volume_group ||= @reused_volume_group
        @volume_group ||= new_volume_group
        @volume_group
      end

      protected

      attr_reader :planned_lvs

      # @return [ProposalSettings]
      attr_reader :settings

      # Checks whether an encrypted LVM was requested.
      #
      # @return [Boolean]
      def encrypt?
        !settings.encryption_password.nil?
      end

      def new_volume_group
        vg = Planned::LvmVg.new(volume_group_name: DEFAULT_VG_NAME, lvs: planned_lvs)
        vg.pvs_encryption_password = settings.encryption_password
        vg.pvs_encryption_method = settings.encryption_method
        vg.pvs_encryption_pbkdf = settings.encryption_pbkdf
        vg.pvs_encryption_authentication = settings.encryption_authentication
        vg.size_strategy = vg_strategy
        vg
      end

      # Whether it makes sense to try to find a volume group to be reused
      #
      # FIXME: Is still undecided (at least is under discussion) whether it
      # makes sense to reuse existing LVMs at all. This method tries to
      # summarize the cases in which we have decided to not do it so far.
      #
      # @return [Boolean]
      def try_to_reuse?
        # Setting introduced to completely avoid LVM reusing in D-Installer.
        return false if settings.lvm_vg_reuse == false

        # We introduced this when we still didn't have a mechanism to activate
        # existing LUKS. Now such mechanism exists but this check has never been
        # removed. Nobody complained so far.
        return false if encrypt?

        # If the planned_lvs are restricted to some particular disk, we likely
        # should only reuse LVMs with all PVs in that disk. Or maybe with at
        # least one PV in that disk. As usual, is not clear.
        return false if planned_lvs.any?(&:disk)

        true
      end
    end
  end
end
