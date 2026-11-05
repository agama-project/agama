#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016-2019] SUSE LLC
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

require "y2storage/proposal_settings"
require "y2storage/partition_tables/type"
require "y2storage/filesystems/type"

RSpec.shared_context "boot requirements" do
  def find_vol(mount_point, volumes)
    volumes.find { |p| p.mount_point == mount_point }
  end

  subject(:checker) { described_class.new(devicegraph, bootloader: bootloader) }

  let(:storage_arch) { instance_double("::Storage::Arch") }
  let(:devicegraph) { double("Y2Storage::Devicegraph") }
  let(:dev_sda) { double("Y2Storage::Disk", name: "/dev/sda", partition_table: boot_partition_table) }
  let(:dev_sdb) { double("Y2Storage::Disk", name: "/dev/sdb") }

  let(:boot_disk) { dev_sda }
  let(:boot_partition_table) { instance_double(Y2Storage::PartitionTables::Base) }
  let(:root_filesystem) { instance_double(Y2Storage::Filesystems::Base) }
  let(:bootloader) { Y2Storage::BootloaderType::GRUB2 }

  let(:analyzer) do
    double(
      "Y2Storage::BootRequirementsStrategies::Analyzer",
      boot_disk:               boot_disk,
      root_filesystem:         root_filesystem,
      root_in_lvm?:            use_lvm,
      root_in_software_raid?:  use_raid,
      encrypted_root?:         use_encryption,
      boot_in_lvm?:            use_lvm,
      boot_in_thin_lvm?:       use_thin_lvm,
      boot_in_bcache?:         use_bcache,
      boot_in_software_raid?:  use_raid,
      encrypted_boot?:         use_encryption,
      btrfs_root?:             use_btrfs,
      boot_filesystem_type:    boot_fs,
      planned_prep_partitions: planned_prep_partitions,
      planned_grub_partitions: planned_grub_partitions,
      planned_esp_partitions:  planned_esp_partitions,
      planned_devices:         planned_grub_partitions + planned_prep_partitions,
      max_planned_weight:      0.0,
      boot_fs_can_embed_grub?: embed_grub,
      root_fs_can_embed_grub?: embed_grub,
      esp_in_lvm?:             false,
      esp_in_software_raid?:   false,
      esp_in_software_raid1?:  false,
      encrypted_esp?:          false,
      boot_encryption_type:    boot_enc_type,
      boot_luks2_pbkdf:        boot_pbkdf
    )
  end

  let(:embed_grub) { false }
  let(:use_lvm) { false }
  let(:use_thin_lvm) { false }
  let(:use_bcache) { false }
  let(:use_raid) { false }
  let(:use_encryption) { false }
  let(:use_btrfs) { true }
  let(:boot_fs) do
    use_btrfs ? Y2Storage::Filesystems::Type::BTRFS : Y2Storage::Filesystems::Type::EXT4
  end
  let(:boot_ptable_type) { :msdos }
  let(:boot_enc_type) { Y2Storage::EncryptionType::NONE }
  let(:boot_pbkdf) { nil }

  # Mocks for Raspberry Pi detection
  let(:raspi_system) { false }
  let(:model_file_content) { raspi_system ? "Raspberry Pi VERSION" : "Another thing" }

  # Assume the needed partitions are not already planned in advance
  let(:planned_prep_partitions) { [] }
  let(:planned_grub_partitions) { [] }
  let(:planned_esp_partitions) { [] }

  before do
    Y2Storage::StorageManager.create_test_instance
    allow(Y2Storage::BootRequirementsStrategies::Analyzer).to receive(:new).and_return(analyzer)

    allow(devicegraph).to receive(:disk_devices).and_return [dev_sda, dev_sdb]
    allow(devicegraph).to receive(:nfs_mounts).and_return []

    allow(analyzer).to receive(:boot_ptable_type?) { |type| type == boot_ptable_type }

    # Mocks for Raspberry Pi detection
    allow(File).to receive(:exist?).and_call_original
    allow(File).to receive(:exist?).with("/proc/device-tree/model").and_return raspi_system
    allow(File).to receive(:read).with("/proc/device-tree/model").and_return model_file_content

    # Assume the needed partitions are not already planned in advance
    allow(analyzer).to receive(:free_mountpoint?).and_return true
  end
end
