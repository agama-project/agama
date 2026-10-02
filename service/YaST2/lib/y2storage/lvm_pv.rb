# Copyright (c) [2017-2021] SUSE LLC
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

require "yast/i18n"
require "y2storage/storage_class_wrapper"
require "y2storage/device"

module Y2Storage
  # A physical volume of the Logical Volume Manager (LVM)
  #
  # This is a wrapper for Storage::LvmPv
  class LvmPv < Device
    include Yast::I18n

    wrap_class Storage::LvmPv

    # @!method self.all(devicegraph)
    #   @param devicegraph [Devicegraph]
    #   @return [Array<Disk>] all the physical volumes in the given devicegraph
    storage_class_forward :all, as: "LvmPv"

    # @!method lvm_vg
    #   @return [LvmVg] volume group the PV is part of
    storage_forward :lvm_vg, as: "LvmVg", check_with: :has_lvm_vg

    # @!method blk_device
    #   Block device directly hosting the PV. That is, for encrypted PVs it
    #   returns the encryption device.
    #
    #   @return [BlkDevice]
    storage_forward :blk_device, as: "BlkDevice", check_with: :has_blk_device

    # @!method usable_size
    #   Returns the size of the PV usable for extents.
    #
    #   @return [DiskSize]
    storage_forward :usable_size, as: "DiskSize"

    # Raw (non encrypted) version of the device hosting the PV.
    #
    # If the PV is not encrypted, this is equivalent to #blk_device, otherwise
    # it returns the original device instead of the encryption one.
    #
    # @return [BlkDevice]
    def plain_blk_device
      blk_device.plain_device
    end

    # Whether the PV is unused (not associated to any VG)
    #
    # @return [Boolean]
    def unused?
      lvm_vg.nil?
    end

    # Display name to represent the PV
    #
    # Only unused PV has its own representation.
    #
    # @return [String, nil]
    def display_name
      return nil unless unused?

      textdomain "storage"

      # TRANSLATORS: display name when the PV has no associated VG, where %{device} is replaced by a
      # device name (e.g., "/dev/sda1").
      format(_("Unused LVM PV on %{device}"), device: plain_blk_device.name)
    end

    protected

    # @see Device#is?
    def types_for_is
      super << :lvm_pv
    end
  end
end
