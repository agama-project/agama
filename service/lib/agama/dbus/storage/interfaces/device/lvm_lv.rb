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
          # Interface for LVM logical volume.
          #
          # @note This interface is intended to be included by {Agama::DBus::Storage::Device} if
          #   needed.
          module LvmLv
            # Whether this interface should be implemented for the given device.
            #
            # @note LVM logical volumes implement this interface.
            #
            # @param storage_device [Y2Storage::Device]
            # @return [Boolean]
            def self.apply?(storage_device)
              storage_device.is?(:lvm_lv)
            end

            LOGICAL_VOLUME_INTERFACE = "org.opensuse.Agama.Storage1.LVM.LogicalVolume"
            private_constant :LOGICAL_VOLUME_INTERFACE

            # LVM volume group hosting the this logical volume.
            #
            # @return [Array<::DBus::ObjectPath>]
            def lvm_lv_vg
              tree.path_for(storage_device.lvm_vg)
            end

            def self.included(base)
              base.class_eval do
                dbus_interface LOGICAL_VOLUME_INTERFACE do
                  dbus_reader :lvm_lv_vg, "o", dbus_name: "VolumeGroup"
                end
              end
            end
          end
        end
      end
    end
  end
end
