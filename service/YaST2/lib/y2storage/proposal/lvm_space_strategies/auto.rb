# Copyright (c) [2017-2026] SUSE LLC
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

require "y2storage/proposal/lvm_space_strategies/base"

module Y2Storage
  module Proposal
    module LvmSpaceStrategies
      # Traditional strategy used by the YaST and AutoYaST proposals to make space in a existing LVM
      # volume group
      #
      # The behavior depends on the value of {Planned::LvmVg#make_space_policy}.
      class Auto < Base
        # Makes space for planned logical volumes
        #
        # When making free space, three different policies can be followed:
        #
        # * :needed: remove logical volumes until there's enough space for
        #            planned ones.
        # * :remove: remove all logical volumes.
        # * :keep:   keep all logical volumes.
        #
        # @see Base#provide_space
        def provide_space
          return if planned_vg.make_space_policy == :keep

          case planned_vg.make_space_policy
          when :needed
            make_space_until_fit
          when :remove
            lvs_to_keep = planned_vg.all_lvs.select(&:reuse?).map(&:reuse_name)
            remove_logical_volumes(lvs_to_keep)
          end
        end

        private

        # Makes sure the given volume group has enough free extends to allocate
        # all the planned volumes, by deleting the existing logical volumes.
        #
        # This method modifies the volume group received as first argument.
        #
        # FIXME: the current implementation does not guarantee that the freed
        # space is the minimum valid one.
        def make_space_until_fit
          while missing_vg_space > DiskSize.zero
            lv_to_delete = delete_candidate(volume_group.lvm_lvs)
            if lv_to_delete.nil?
              error_msg = "The volume group #{volume_group.vg_name} is not big enough"
              raise NoDiskSpaceError, error_msg
            end
            volume_group.delete_lvm_lv(lv_to_delete)
          end
        end

        # Remove all logical volumes from a volume group
        #
        # This method modifies the volume group received as a first argument.
        #
        # @param lvs_to_keep  [Array<String>] name of logical volumes to keep
        def remove_logical_volumes(lvs_to_keep)
          lvs_to_remove = volume_group.all_lvm_lvs.reject { |v| lvs_to_keep.include?(v.name) }
          lvs_to_remove.each { |v| volume_group.delete_lvm_lv(v) }
        end
      end
    end
  end
end
