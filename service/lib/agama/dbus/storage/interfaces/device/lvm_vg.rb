# frozen_string_literal: true

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

require "dbus"

module Agama
  module DBus
    module Storage
      module Interfaces
        module Device
          # Interface for a LVM Volume Group.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module LvmVg
            # Whether this interface should be implemented for the given device.
            #
            # @note LVM Volume Groups implement this interface.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:lvm_vg)
            end

            VOLUME_GROUP_INTERFACE = "org.opensuse.Agama.Storage1.LVM.VolumeGroup"
            private_constant :VOLUME_GROUP_INTERFACE

            # Size of the volume group in bytes
            #
            # @return [Integer]
            def lvm_vg_size
              storage_device.size.to_i
            end

            # D-Bus paths of the objects representing the physical volumes.
            #
            # @return [Array<String>]
            def lvm_vg_pvs
              storage_device.lvm_pvs.map { |p| tree.path_for(p.plain_blk_device) }
            end

            # D-Bus paths of the objects representing the logical volumes.
            #
            # @return [Array<String>]
            def lvm_vg_lvs
              storage_device.lvm_lvs.map { |l| tree.path_for(l) }
            end

            def self.included(base)
              base.class_eval do
                dbus_interface VOLUME_GROUP_INTERFACE do
                  dbus_reader :lvm_vg_size, "t", dbus_name: "Size"
                  dbus_reader :lvm_vg_pvs, "ao", dbus_name: "PhysicalVolumes"
                  dbus_reader :lvm_vg_lvs, "ao", dbus_name: "LogicalVolumes"
                end
              end
            end
          end
        end
      end
    end
  end
end
