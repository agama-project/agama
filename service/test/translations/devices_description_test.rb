# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

# Translated strings of Y2Storage::DeviceDescription (and the ones it uses from
# Y2Storage::Filesystems::BlkFilesystem), textdomain "storage".
#
# The description is returned in the "description" property of every device of the JSON generated
# by Agama::Storage::DevicegraphConversions::ToJSON (see to_json_conversions/device.rb), which is
# what Agama::DBus::Storage::Manager#devices_json sends in the "System" and "Proposal" properties.
#
# The tests only check the English (untranslated) text, no locale is switched.

require_relative "../test_helper"
require_relative "../agama/storage/storage_helpers"
require "agama/storage/devicegraph_conversions/to_json"
require "tmpdir"
require "y2storage"

describe "Translated device descriptions" do
  include Agama::RSpec::StorageHelpers

  graphs = "yast2/y2storage/devicegraphs"

  # Flattens the devices (and their partitions or logical volumes) of the JSON by name.
  def devices_by_name(graph)
    json = Agama::Storage::DevicegraphConversions::ToJSON.new(graph).convert
    flatten = lambda do |device|
      [device] + (device[:partitions] || []).flat_map(&flatten) +
        (device[:logicalVolumes] || []).flat_map(&flatten)
    end
    json.flat_map(&flatten).to_h { |d| [d[:name], d] }
  end

  before do
    # libstorage-ng would try to inspect the (fake) devices to find out how they can be resized.
    allow_any_instance_of(Y2Storage::Device).to receive(:detect_resize_info)
      .and_return(Y2Storage::ResizeInfo.new(Storage::ResizeInfo.new(false, 0)))
    # Reading the system name would try to mount the (fake) file systems.
    allow_any_instance_of(Y2Storage::Filesystems::Base).to receive(:system_name).and_return(nil)
  end

  # Cases using a device of the probed devicegraph of a fixture.
  #
  # Each case is [msgid(s), fixture, device name, expected description]
  fixture_cases = [
    ["Disk", "#{graphs}/alignment.yml", "/dev/sda", "Disk"],
    ["Multipath", "#{graphs}/bug_11166258.xml", "/dev/mapper/360050768028383d7f000000000000195",
     "Multipath"],
    ["BIOS RAID", "empty-dm_raids.xml", "/dev/mapper/isw_ddgdcbibhd_test1", "BIOS RAID"],
    ["RAID", "#{graphs}/empty-md_raid.yml", "/dev/md/VirtualDisk01", "RAID"],
    ["LVM", "trivial_lvm.yml", "/dev/vg0", "LVM"],
    ["Thin Pool", "#{graphs}/lvm-types1.xml", "/dev/vg0/thinpool0", "Thin Pool"],
    ["RAID LV", "#{graphs}/lvm-types1.xml", "/dev/vg0/raid1_lv1", "Ext4 RAID LV"],
    ["Cache LV", "#{graphs}/lvm-types1.xml", "/dev/vg0/cached1", "XFS Cache LV"],
    ["Cache Pool", "#{graphs}/lvm-types1.xml", "/dev/vg0/unused_cache_pool", "Cache Pool"],
    ["LV", "#{graphs}/lvm-types1.xml", "/dev/vg0/normal3", "Ext4 LV"],
    ["Xen", "#{graphs}/xen-disks-and-partitions.xml", "/dev/xvda1", "Xen"],
    ["Partition", "#{graphs}/md_raid.yml", "/dev/sda3", "Ext4 Partition"],
    ["%{fs_type} %{device_label}", "#{graphs}/md_raid.yml", "/dev/sda3", "Ext4 Partition"],
    ["Encrypted %s", "#{graphs}/complex-lvm-encrypt.yml", "/dev/sdc", "Encrypted Disk"],
    ["Encrypted %{fs_type} %{device_label}", "#{graphs}/complex-lvm-encrypt.yml", "/dev/sda4",
     "Encrypted Ext4 Partition"],
    ["Unused LVM PV", "#{graphs}/unused_lvm_pvs.xml", "/dev/sda2", "Unused LVM PV"],
    ["Unused encrypted LVM PV", "#{graphs}/unused_lvm_pvs.xml", "/dev/sda3",
     "Unused encrypted LVM PV"],
    ["PV of %s", "#{graphs}/unused_lvm_pvs.xml", "/dev/sda1", "PV of volgroup"],
    ["Encrypted PV of %s", "#{graphs}/complex-lvm-encrypt.yml", "/dev/sdd", "Encrypted PV of vg0"],
    ["Snapshot of %{origin}", "#{graphs}/lvm-types1.xml", "/dev/vg0/snap_normal1",
     "Snapshot of normal1"],
    ["%{fs_type} Journal (%{data_device_name})", "#{graphs}/bug_1145841.xml", "/dev/sdd1",
     "Ext4 Journal (BACKUP_R6)"],
    ["Part of %{fs_name} %{blk_device_name}",
     "#{graphs}/btrfs-multidevice-over-partitions.xml", "/dev/sda1", "Part of btrfs (sda1…)"],
    # BlkFilesystem#blk_device_basename is used to build the name of the device
    ["(%{basename}…)", "#{graphs}/btrfs-multidevice-over-partitions.xml", "/dev/sdb1",
     "Part of btrfs (sda1…)"],
    ["Backing of %{bcache}", "#{graphs}/bcache-root-ext4.xml", "/dev/sda3", "Backing of bcache0"],
    ["Bcache caching", "#{graphs}/bcache-root-ext4.xml", "/dev/sdb", "Bcache caching"],
    ["Part of %s", "#{graphs}/md_raid.yml", "/dev/sda1", "Part of md0"],
    ["Encrypted part of %s", "#{graphs}/subvolumes-and-empty-md.xml", "/dev/sda5",
     "Encrypted part of strip0"]
  ]

  fixture_cases.each do |msgid, fixture, device_name, expected|
    it "returns '#{expected}' for #{device_name} (msgid '#{msgid}')" do
      mock_storage(devicegraph: fixture)
      graph = Y2Storage::StorageManager.instance.probed

      expect(devices_by_name(graph)[device_name][:description]).to eq(expected)
    end
  end

  # Cases that need to modify the staging devicegraph of a fixture.
  #
  # Each case is [msgid, fixture, device name, expected description, modification]
  staging_cases = [
    ["Encrypted Snapshot of %{origin}", "lvm_with_nested_thin_lvs.xml", "/dev/vg_a/lv_02_snap",
     "Encrypted Snapshot of lv_02",
     lambda do |graph|
       snapshot = graph.find_by_name("/dev/vg_a/lv_02_snap")
       snapshot.remove_descendants
       snapshot.create_encryption("cr_snap")
     end],
    ["Part of encrypted %{fs_name} %{blk_device_name}",
     "#{graphs}/btrfs-multidevice-over-partitions.xml", "/dev/sdb1",
     "Part of encrypted btrfs (sda1…)",
     lambda do |graph|
       partitions = graph.partitions.select { |p| p.filesystem&.multidevice? }
       encryptions = partitions.map do |part|
         part.remove_descendants
         part.create_encryption("cr_#{part.basename}")
       end
       filesystem = encryptions.first.create_blk_filesystem(Y2Storage::Filesystems::Type::BTRFS)
       encryptions[1..-1].each { |e| filesystem.add_device(e) }
     end],
    ["Encrypted backing of %{bcache}", "#{graphs}/bcache-root-ext4.xml", "/dev/sda3",
     "Encrypted backing of bcache0",
     lambda do |graph|
       bcache = graph.find_by_name("/dev/bcache0")
       backing = bcache.backing_device
       cset = bcache.bcache_cset
       backing.remove_descendants
       new_bcache = backing.create_encryption("cr_backing").create_bcache("/dev/bcache0")
       new_bcache.add_bcache_cset(cset)
     end]
  ]

  staging_cases.each do |msgid, fixture, device_name, expected, modification|
    it "returns '#{expected}' for #{device_name} (msgid '#{msgid}')" do
      mock_storage(devicegraph: fixture)
      graph = Y2Storage::StorageManager.instance.staging
      modification.call(graph)

      expect(devices_by_name(graph)[device_name][:description]).to eq(expected)
    end
  end

  # Cases that need a fixture with a type of logical volume that is not available in the fixtures.
  # The fixture is a copy of lvm-types1.xml in which a RAID LV is replaced by the given type.
  {
    "Mirror LV"     => ["mirror", "Ext2 Mirror LV"],
    "Writecache LV" => ["writecache", "Ext2 Writecache LV"]
  }.each do |msgid, (lv_type, expected)|
    it "returns '#{expected}' for a #{lv_type} logical volume (msgid '#{msgid}')" do
      Dir.mktmpdir do |dir|
        xml = File.read(File.join(FIXTURES_PATH, graphs, "lvm-types1.xml"))
        path = File.join(dir, "lvm-#{lv_type}.xml")
        File.write(path, xml.sub("<lv-type>raid</lv-type>", "<lv-type>#{lv_type}</lv-type>"))

        mock_hwinfo(Y2Storage::HWInfoDisk.new)
        Y2Storage::StorageManager.create_test_instance.probe_from_xml(path)
        graph = Y2Storage::StorageManager.instance.probed

        expect(devices_by_name(graph)["/dev/vg0/mirror_lv1"][:description]).to eq(expected)
      end
    end
  end
end
