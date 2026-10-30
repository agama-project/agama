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

require "y2storage/storage_manager"
require "y2storage/simple_etc_fstab_entry"

module Y2Storage
  # Helper class to generate the label of the filesystem
  class FilesystemLabel
    # Constructor
    #
    # @param device [Y2Storage::Device, Y2Storage::LvmPv, Y2Storage::SimpleEtcFstabEntry]
    # @param system_graph [Y2Storage::Devicegraph] Representation of the system in its initial state
    def initialize(device, system_graph: nil)
      @device = device
      @system_graph = system_graph || StorageManager.instance.probed
    end

    # Text representation of the filesystem label
    #
    # @return [String]
    def to_s
      return fstab_filesystem_label(device) if device.is_a?(SimpleEtcFstabEntry)

      filesystem_label(device)
    end

    private

    # @return [Y2Storage::Device, Y2Storage::LvmPv, Y2Storage::SimpleEtcFstabEntry]
    attr_reader :device

    # @return [Y2Storage::Devicegraph]
    attr_reader :system_graph

    # Returns the label for the given device, when possible
    #
    # @param device [Y2Storage::Device, nil]
    # @return [String] the label if possible; empty string otherwise
    def filesystem_label(device)
      return "" unless device
      return "" if device.is?(:btrfs_subvolume)

      filesystem = filesystem_for(device)

      return "" unless filesystem
      return "" if part_of_multidevice?(device, filesystem)
      # fs may not support labels, like NFS
      return "" unless filesystem.respond_to?(:label)

      filesystem.label
    end

    # Returns the label for the given fstab entry, when possible
    #
    # @see #filesystem_label
    # @param fstab_entry [Y2Storage::SimpleEtcFstabEntry]
    def fstab_filesystem_label(fstab_entry)
      device = fstab_entry.device(system_graph)

      filesystem_label(device)
    end

    # Returns the filesystem for the given device, when possible
    #
    # @return [Y2Storage::Filesystems::Base, nil]
    def filesystem_for(device)
      if device.is?(:filesystem)
        device
      elsif device.respond_to?(:filesystem)
        device.filesystem
      end
    end

    # Whether the device belongs to a multi-device filesystem
    #
    # @param device [Device]
    # @return [Boolean]
    def part_of_multidevice?(device, filesystem)
      return false unless device.is?(:blk_device)

      filesystem.multidevice?
    end
  end
end
