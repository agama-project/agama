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

require "yast/i18n"
require "y2storage/storage_manager"
require "y2storage/simple_etc_fstab_entry"

module Y2Storage
  # Helper class to generate a description for a device
  class DeviceDescription
    extend Yast::I18n
    include Yast::I18n

    # Constructor
    #
    # @param device [Y2Storage::Device, Y2Storage::LvmPv, Y2Storage::SimpleEtcFstabEntry]
    # @param system_graph [Y2Storage::Devicegraph] Representation of the system in its initial state
    # @param include_encryption [Boolean] Whether to include the encryption status in the label or not
    def initialize(device, system_graph: nil, include_encryption: false)
      textdomain "storage"
      @device = device
      @system_graph = system_graph || StorageManager.instance.probed
      @include_encryption = include_encryption
    end

    # Text representation of the description
    #
    # @return [String]
    def to_s
      device_label(device)
    end

    private

    # @return [Y2Storage::Device, Y2Storage::LvmPv, Y2Storage::SimpleEtcFstabEntry]
    attr_reader :device

    # @return [Y2Storage::Devicegraph]
    attr_reader :system_graph

    # @return [Boolean]
    attr_reader :include_encryption

    # Default labels based on the device type
    #
    # @see #default_label
    DEVICE_LABELS = {
      bcache:          N_("Bcache"),
      disk:            N_("Disk"),
      dasd:            N_("Disk"),
      multipath:       N_("Multipath"),
      nfs:             N_("NFS"),
      bios_raid:       N_("BIOS RAID"),
      software_raid:   N_("RAID"),
      lvm_pv:          N_("PV"),
      lvm_vg:          N_("LVM"),
      lvm_thin:        N_("Thin LV"),
      lvm_thin_pool:   N_("Thin Pool"),
      lvm_raid:        N_("RAID LV"),
      lvm_cache:       N_("Cache LV"),
      lvm_cache_pool:  N_("Cache Pool"),
      lvm_writecache:  N_("Writecache LV"),
      lvm_snapshot:    N_("Snapshot LV"),
      lvm_mirror:      N_("Mirror LV"),
      lvm_lv:          N_("LV"),
      stray:           N_("Xen"),
      partition:       N_("Partition"),
      btrfs_subvolume: N_("Btrfs Subvolume")
    }
    private_constant :DEVICE_LABELS

    # A text describing the device
    #
    # @param device [Y2Storage::Device, Y2Storage::LvmPv, Y2Storage::SimpleEtcFstabEntry]
    # @return [String]
    def device_label(device)
      return fstab_device_label(device) if device.is_a?(SimpleEtcFstabEntry)
      return filesystem_label(device) if device.is?(:filesystem)
      return default_label(device, false) if device.is?(:lvm_vg, :btrfs_subvolume)
      return snapshot_type_label(device) if device.is?(:lvm_snapshot)

      formatted_device_type_label(device) || unformatted_device_type_label(device)
    end

    # Filesystem name
    #
    # @param filesystem [Y2Storage::Filesystems::Base]
    # @return [String]
    def filesystem_label(filesystem)
      label = filesystem.type.to_human_string
      if filesystem.encrypted? && include_encryption
        # TRANSLATORS: %s is a type of filesystem
        format(_("Encrypted %s"))
      else
        label
      end
    end

    # Label for the device in the given fstab entry
    #
    # @param fstab_entry [Y2Storage::SimpleEtcFstabEntry]
    # @return [String] the #device_label if device is found in the system; empty string otherwise
    def fstab_device_label(fstab_entry)
      device = fstab_entry.device(system_graph)
      return "" unless device

      device_label(device)
    end

    # Label for a formatted device (e.g., Ext4 LVM, XFS RAID, Swap Partition, etc)
    #
    # @return [String, nil] label if the device has a filesystem; nil otherwise
    def formatted_device_type_label(device)
      fs = filesystem_for(device)

      return nil unless fs

      if device.journal?
        journal_type_label(fs, device.encrypted?)
      elsif show_multidevice_type_label?(fs)
        multidevice_type_label(fs, device.encrypted?)
      elsif device.encrypted? && include_encryption
        # TRANSLATORS: Encrypted device
        #              %{fs_type} is the filesystem type. I.e., FAT, Ext4, etc
        #              %{device_label} is the device label. I.e., Partition, Disk, etc
        format(
          _("Encrypted %{fs_type} %{device_label}"),
          fs_type:      fs_type(device, fs),
          # false to avoid adding "Encrypted" twice
          device_label: default_label(device, false)
        )
      else
        # TRANSLATORS: %{fs_type} is the filesystem type. I.e., FAT, Ext4, etc
        #              %{device_label} is the device label. I.e., Partition, Disk, etc
        format(
          _("%{fs_type} %{device_label}"),
          fs_type:      fs_type(device, fs),
          device_label: default_label(device, false)
        )
      end
    end

    # The filesystem type representation (FAT, Ext4, etc)
    #
    # @return [String]
    def fs_type(device, filesystem)
      if device.is?(:partition) && device.efi_system?
        device.id.to_human_string
      else
        filesystem.type.to_human_string
      end
    end

    # Label for unformatted device (e.g., LVM, RAID, Partition, etc)
    #
    # @return [String]
    def unformatted_device_type_label(device)
      if device.lvm_pv
        lvm_pv_type_label(device.lvm_pv, device.encrypted?)
      elsif device.md
        part_of_label(device.md, device.encrypted?)
      elsif device.bcache
        bcache_backing_label(device.bcache, device.encrypted?)
      elsif device.in_bcache_cset
        bcache_cset_label
      else
        default_unformatted_label(device, device.encrypted?)
      end
    end

    # Label when the device is a LVM physical volume
    #
    # @param lvm_pv [Y2Storage::LvmPv]
    # @param encrypted [Boolean]
    # @return [String]
    def lvm_pv_type_label(lvm_pv, encrypted)
      vg = lvm_pv.lvm_vg

      if vg.nil?
        return _("Unused encrypted LVM PV") if encrypted && include_encryption

        return _("Unused LVM PV")
      end

      if vg.basename.empty?
        return _("Encrypted PV of LVM") if encrypted && include_encryption

        return _("PV of LVM")
      end

      if encrypted && include_encryption
        # TRANSLATORS: %s is the volume group name. E.g., "vg0"
        return format(_("Encrypted PV of %s"), vg.basename)
      end

      # TRANSLATORS: %s is the volume group name. E.g., "vg0"
      format(_("PV of %s"), vg.basename)
    end

    # Label for an LVM snapshot device
    #
    # @param lvm_snapshot [Y2Storage::LvmLv]
    # @return [String]
    def snapshot_type_label(lvm_snapshot)
      label =
        if lvm_snapshot.is?(:lvm_thin_snapshot)
          if lvm_snapshot.encrypted? && include_encryption
            # TRANSLATORS: %{origin} is replaced by an LVM logical volume name
            # (e.g., /dev/vg0/user-data)
            _("Encrypted Thin Snapshot of %{origin}")
          else
            # TRANSLATORS: %{origin} is replaced by an LVM logical volume name
            # (e.g., /dev/vg0/user-data)
            _("Thin Snapshot of %{origin}")
          end
        elsif lvm_snapshot.encrypted? && include_encryption
          _("Encrypted Snapshot of %{origin}")
        # TRANSLATORS: %{origin} is replaced by an LVM logical volume name
        # (e.g., /dev/vg0/user-data)
        else
          # TRANSLATORS: %{origin} is replaced by an LVM logical volume name
          # (e.g., /dev/vg0/user-data)
          _("Snapshot of %{origin}")
        end

      format(label, origin: lvm_snapshot.origin.lv_name)
    end

    # Label when the device holds a journal
    #
    # @param filesystem [Y2Storage::BlkFilesystem]
    # @param encrypted [Boolean]
    # @return [String]
    def journal_type_label(filesystem, encrypted)
      data_device = filesystem.blk_devices.find { |d| !d.journal? }

      if encrypted && include_encryption
        # TRANSLATORS: Encrypted journal device
        #              %{fs_type} is the filesystem type. E.g., Btrfs, Ext4, etc.
        #              %{data_device_name} is the data device name. E.g., sda1
        format(
          _("Encrypted %{fs_type} Journal (%{data_device_name})"),
          fs_type:          filesystem.type.to_human_string,
          data_device_name: data_device.basename
        )
      else
        # TRANSLATORS: %{fs_type} is the filesystem type. E.g., Btrfs, Ext4, etc.
        #              %{data_device_name} is the data device name. E.g., sda1
        format(
          _("%{fs_type} Journal (%{data_device_name})"),
          fs_type:          filesystem.type.to_human_string,
          data_device_name: data_device.basename
        )
      end
    end

    # Label when the device belongs to a multi-device filesystem
    #
    # @param filesystem [Y2Storage::BlkFilesystem]
    # @param encrypted [Boolean]
    # @return [String]
    def multidevice_type_label(filesystem, encrypted)
      if encrypted && include_encryption
        # TRANSLATORS: %{fs_name} is the filesystem name. E.g., Btrfs, Ext4, etc.
        #              %{blk_device_name} is a device base name. E.g., sda1...
        format(
          _("Part of encrypted %{fs_name} %{blk_device_name}"),
          fs_name:         filesystem.type,
          blk_device_name: filesystem.blk_device_basename
        )
      else
        # TRANSLATORS: %{fs_name} is the filesystem name. E.g., Btrfs, Ext4, etc.
        #              %{blk_device_name} is a device base name. E.g., sda1...
        format(
          _("Part of %{fs_name} %{blk_device_name}"),
          fs_name:         filesystem.type,
          blk_device_name: filesystem.blk_device_basename
        )
      end
    end

    # Label when the device is used as backing device of a Bcache
    #
    # @param [Y2Storage::Device] device
    # @param encrypted [Boolean]
    def bcache_backing_label(device, encrypted)
      if encrypted && include_encryption
        # TRANSLATORS: %{bcache} is replaced by a device name (e.g., bcache0).
        format(_("Encrypted backing of %{bcache}"), bcache: device.basename)
      else
        # TRANSLATORS: %{bcache} is replaced by a device name (e.g., bcache0).
        format(_("Backing of %{bcache}"), bcache: device.basename)
      end
    end

    # Label when the device is used as caching device in a Bcache
    #
    # @return [String]
    def bcache_cset_label
      # TRANSLATORS: an special type of device
      _("Bcache caching")
    end

    # Label when the device is part of another one, like Bcache or RAID
    #
    # @param ancestor_device [Y2Storage::BlkDevice]
    # @param encrypted [Boolean]
    # @return [String]
    def part_of_label(ancestor_device, encrypted)
      if encrypted && include_encryption
        format(_("Encrypted part of %s"), ancestor_device.basename)
      else
        format(_("Part of %s"), ancestor_device.basename)
      end
    end

    # Default label when device is unformatted
    #
    # @param encrypted [Boolean]
    # @return [String]
    def default_unformatted_label(device, encrypted)
      # The "model" field from hwinfo is a combination of vendor + device with quite some added
      # heuristics to make the result nice looking. See comment#66 at bsc#1200975.
      model = device.model || ""

      return model unless model.empty?
      return device.id.to_human_string if device.respond_to?(:id)

      default_label(device, encrypted)
    end

    # Default label for the device
    #
    # @see DEVICE_LABELS
    #
    # @param device [Y2Storage::Device]
    # @param encrypted [Boolean]
    # @return [String]
    def default_label(device, encrypted)
      type = DEVICE_LABELS.keys.find { |k| device.is?(k) }

      return "" if type.nil?

      label = _(DEVICE_LABELS[type])

      if encrypted && include_encryption
        # TRANSLATORS: %s is a type of the device, e.g. disk, partition, RAID, LVM,...
        label = format(_("Encrypted %s"), label)
      end

      label
    end

    # Whether the "Part of *fs.type*" label should be displayed
    #
    # The Ext3/4 filesystem could be detected as a multi-device filesystem
    # when its journal is placed in an external device. However, we do not
    # want to display "Part of ..." for them because we know that data
    # partition is over a single device.
    #
    # @see #formatted_device_type_label
    # @return [Boolean] true if the filesystem is multi-device BUT not an Ext3/4 one
    def show_multidevice_type_label?(filesystem)
      return false unless filesystem
      return false if filesystem.type.is?(:ext3, :ext4)

      filesystem.multidevice?
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
  end
end
