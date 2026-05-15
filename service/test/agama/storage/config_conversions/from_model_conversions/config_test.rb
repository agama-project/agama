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

require_relative "./context"
require "agama/config"
require "agama/storage/config"
require "agama/storage/config_conversions/from_model_conversions/config"
require "agama/storage/configs/boot"
require "agama/storage/configs/boot_device"
require "agama/storage/configs/drive"
require "agama/storage/configs/encryption"
require "agama/storage/configs/md_raid"
require "agama/storage/bootloader_config"

describe Agama::Storage::ConfigConversions::FromModelConversions::Config do
  include_context "from model conversions"

  let(:bootloader_config) { Agama::Storage::BootloaderConfig.new }

  subject do
    described_class.new(model_json, product_config, bootloader_config, storage_system)
  end

  describe "#convert" do
    let(:model_json) do
      {
        encryption:   encryption,
        boot:         boot,
        drives:       drives,
        volumeGroups: volume_groups,
        mdRaids:      md_raids
      }
    end

    let(:encryption) { nil }
    let(:boot) { nil }
    let(:drives) { nil }
    let(:volume_groups) { nil }
    let(:md_raids) { nil }

    it "returns a storage config" do
      config = subject.convert
      expect(config).to be_a(Agama::Storage::Config)
    end

    context "if 'boot' is not specified" do
      let(:boot) { nil }

      it "sets #boot to the expected value" do
        config = subject.convert
        expect(config.boot).to be_a(Agama::Storage::Configs::Boot)
        expect(config.boot.configure).to eq(true)
        expect(config.boot.device).to be_a(Agama::Storage::Configs::BootDevice)
        expect(config.boot.device.default).to eq(true)
        expect(config.boot.device.device_alias).to be_nil
      end
    end

    context "if 'drives' is not specified" do
      let(:drives) { nil }

      it "sets #drives to the expected value" do
        config = subject.convert
        expect(config.drives).to be_empty
      end
    end

    context "if 'volumeGroups' is not specified" do
      let(:volume_groups) { nil }

      it "sets #volume_groups to the expected value" do
        config = subject.convert
        expect(config.volume_groups).to be_empty
      end
    end

    context "if 'mdRaids' is not specified" do
      let(:md_raids) { nil }

      it "sets #md_raids to the expected value" do
        config = subject.convert
        expect(config.md_raids).to be_empty
      end
    end

    context "if 'boot' is specified" do
      let(:boot) do
        {
          configure: true,
          device:    {
            default: true
          }
        }
      end

      it "sets #boot to the expected value" do
        config = subject.convert
        boot = config.boot
        expect(boot.configure?).to eq(true)
        expect(boot.device.default?).to eq(true)
        expect(boot.device.device_alias).to be_nil
      end

      context "and there is a drive config for the given boot device name" do
        let(:boot) do
          {
            configure: true,
            device:    {
              default: false,
              name:    "/dev/vda"
            }
          }
        end

        let(:drives) do
          [
            { name: "/dev/vda" }
          ]
        end

        it "does not add more drives" do
          config = subject.convert
          expect(config.drives.size).to eq(1)
          expect(config.drives.first.search.name).to eq("/dev/vda")
        end

        it "sets an alias to the drive config" do
          config = subject.convert
          drive = config.drives.first
          expect(drive.alias).to_not be_nil
        end

        it "sets #boot to the expected value" do
          config = subject.convert
          boot = config.boot
          drive = config.drives.first
          expect(boot.configure?).to eq(true)
          expect(boot.device.default?).to eq(false)
          expect(boot.device.device_alias).to eq(drive.alias)
        end
      end

      context "and there is not a drive config for the given boot device name" do
        let(:boot) do
          {
            configure: true,
            device:    {
              default: false,
              name:    "/dev/vda"
            }
          }
        end

        let(:drives) do
          [
            { name: "/dev/vdb" }
          ]
        end

        it "adds a drive for the boot device" do
          config = subject.convert
          expect(config.drives.size).to eq(2)

          drive = config.drives.find { |d| d.search.name == "/dev/vda" }
          expect(drive.alias).to_not be_nil
          expect(drive.partitions).to be_empty
        end

        it "sets #boot to the expected value" do
          config = subject.convert
          boot = config.boot
          drive = config.drives.find { |d| d.search.name == "/dev/vda" }
          expect(boot.configure?).to eq(true)
          expect(boot.device.default?).to eq(false)
          expect(boot.device.device_alias).to eq(drive.alias)
        end
      end

      context "and there is a MD RAID config for the given boot device name" do
        let(:boot) do
          {
            configure: true,
            device:    {
              default: false,
              name:    "/dev/md0"
            }
          }
        end

        let(:md_raids) do
          [
            { name: "/dev/md0" }
          ]
        end

        it "does not add more MD RAIDs" do
          config = subject.convert
          expect(config.md_raids.size).to eq(1)
          expect(config.md_raids.first.search.name).to eq("/dev/md0")
        end

        it "sets an alias to the MD RAID config" do
          config = subject.convert
          md = config.md_raids.first
          expect(md.alias).to_not be_nil
        end

        it "sets #boot to the expected value" do
          config = subject.convert
          boot = config.boot
          md = config.md_raids.first
          expect(boot.configure?).to eq(true)
          expect(boot.device.default?).to eq(false)
          expect(boot.device.device_alias).to eq(md.alias)
        end
      end

      context "and there is not a MD RAID config for the given boot device name" do
        let(:scenario) { "md_raids.yaml" }

        let(:boot) do
          {
            configure: true,
            device:    {
              default: false,
              name:    "/dev/md0"
            }
          }
        end

        let(:md_raids) do
          [
            { name: "/dev/md1" }
          ]
        end

        it "adds a MD RAID for the boot device" do
          config = subject.convert
          expect(config.md_raids.size).to eq(2)

          md = config.md_raids.find { |d| d.search.name == "/dev/md0" }
          expect(md.alias).to_not be_nil
          expect(md.partitions).to be_empty
        end

        it "sets #boot to the expected value" do
          config = subject.convert
          boot = config.boot
          md = config.md_raids.find { |d| d.search.name == "/dev/md0" }
          expect(boot.configure?).to eq(true)
          expect(boot.device.default?).to eq(false)
          expect(boot.device.device_alias).to eq(md.alias)
        end
      end
    end

    context "if 'drives' is specified" do
      context "with an empty list" do
        let(:drives) { [] }

        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives).to eq([])
        end
      end

      context "with a list of drives" do
        let(:drives) do
          [
            { name: "/dev/vda" },
            { name: "/dev/vdb" }
          ]
        end

        it "sets #drives to the expected value" do
          config = subject.convert
          expect(config.drives.size).to eq(2)
          expect(config.drives).to all(be_a(Agama::Storage::Configs::Drive))

          drive1, drive2 = config.drives
          expect(drive1.search.name).to eq("/dev/vda")
          expect(drive1.partitions).to eq([])
          expect(drive2.search.name).to eq("/dev/vdb")
          expect(drive2.partitions).to eq([])
        end
      end
    end

    context "if 'mdRaids' is specified" do
      context "with an empty list" do
        let(:md_raids) { [] }

        it "sets #md_raids to the expected value" do
          config = subject.convert
          expect(config.md_raids).to eq([])
        end
      end

      context "with a list of raids" do
        let(:md_raids) do
          [
            { name: "/dev/md0" },
            { name: "/dev/md1" }
          ]
        end

        it "sets #md_raids to the expected value" do
          config = subject.convert
          expect(config.md_raids.size).to eq(2)
          expect(config.md_raids).to all(be_a(Agama::Storage::Configs::MdRaid))

          md_raid1, md_raid2 = config.md_raids
          expect(md_raid1.search.name).to eq("/dev/md0")
          expect(md_raid1.partitions).to eq([])
          expect(md_raid2.search.name).to eq("/dev/md1")
          expect(md_raid2.partitions).to eq([])
        end
      end
    end

    context "if 'volumeGroups' is specified" do
      context "with an empty list" do
        let(:volume_groups) { [] }

        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups).to eq([])
        end
      end

      context "with a list of volume groups" do
        let(:volume_groups) do
          [
            { name: "/dev/vg0" },
            { name: "/dev/vg1" }
          ]
        end

        it "sets #volume_groups to the expected value" do
          config = subject.convert
          expect(config.volume_groups.size).to eq(2)
          expect(config.volume_groups).to all(be_a(Agama::Storage::Configs::VolumeGroup))

          vg1, vg2 = config.volume_groups
          expect(vg1.search.name).to eq("/dev/vg0")
          expect(vg1.logical_volumes).to eq([])
          expect(vg2.search.name).to eq("/dev/vg1")
          expect(vg2.logical_volumes).to eq([])
        end
      end

      context "if a volume group specifies 'targetDevices'" do
        let(:scenario) { "md_raids.yaml" }

        let(:volume_groups) { [{ targetDevices: ["/dev/vda", "/dev/vdb", "/dev/md0"] }] }

        let(:drives) do
          [
            { name: "/dev/vda" },
            { name: "/dev/vdc" }
          ]
        end

        let(:md_raids) do
          [
            { name: "/dev/md1" }
          ]
        end

        it "adds the missing drives" do
          config = subject.convert
          expect(config.drives.size).to eq(3)
          expect(config.drives).to all(be_a(Agama::Storage::Configs::Drive))
          expect(config.drives).to include(an_object_having_attributes({ device_name: "/dev/vdb" }))
        end

        it "adds the missing MD RAIDs" do
          config = subject.convert
          expect(config.md_raids.size).to eq(2)
          expect(config.md_raids).to all(be_a(Agama::Storage::Configs::MdRaid))
          expect(config.md_raids)
            .to include(an_object_having_attributes({ device_name: "/dev/md0" }))
        end
      end
    end

    context "if 'encryption' is specified" do
      let(:drives) do
        [
          {
            name:       "/dev/vda",
            partitions: [
              {
                name:      "/dev/vda1",
                mountPath: "/test"
              },
              {
                name:       "/dev/vda2",
                mountPath:  "/test2",
                filesystem: { reuse: true }
              },
              {
                mountPath: "/boot/efi"
              },
              {
                mountPath: "/test3"
              },
              {}
            ]
          }
        ]
      end

      let(:md_raids) do
        [
          {
            name:       "/dev/md0",
            partitions: [
              { name: "/dev/md0-p1" },
              {}
            ]
          }
        ]
      end

      let(:volume_groups) do
        [
          {
            vgName:        "system",
            targetDevices: ["/dev/vda"]
          }
        ]
      end

      context "without TPM" do
        let(:encryption) do
          {
            password: "12345"
          }
        end

        it "sets #encryption with LUKS2 method to the newly formatted partitions, except the " \
           "boot-related ones" do
          config = subject.convert
          partitions = config.partitions
          new_partitions = partitions.reject(&:search)
          reused_partitions = partitions.select(&:search)
          mounted_partitions, reformatted_partitions = reused_partitions.partition do |part|
            part.filesystem.reuse?
          end
          new_non_boot_partitions, new_boot_partitions = new_partitions.partition do |part|
            part.filesystem&.path != "/boot/efi"
          end

          expect(new_non_boot_partitions.map { |p| p.encryption.method.id }).to all(eq(:luks2))
          expect(new_non_boot_partitions.map { |p| p.encryption.password }).to all(eq("12345"))
          expect(reformatted_partitions.map { |p| p.encryption.method.id }).to all(eq(:luks2))
          expect(reformatted_partitions.map { |p| p.encryption.password }).to all(eq("12345"))
          expect(mounted_partitions.map(&:encryption)).to all(be_nil)
          expect(new_boot_partitions.map(&:encryption)).to all(be_nil)
        end

        it "sets #encryption with LUKS2 method for the automatically created physical volumes" do
          config = subject.convert
          volume_group = config.volume_groups.first
          target_encryption = volume_group.physical_volumes_encryption

          expect(target_encryption.method.id).to eq(:luks2)
          expect(target_encryption.password).to eq("12345")
        end
      end

      context "with TPM and grub2 bootloader" do
        let(:bootloader_config) do
          config = Agama::Storage::BootloaderConfig.new
          config.type = Y2Storage::BootloaderType::GRUB2
          config
        end

        let(:encryption) do
          {
            tpm:      true,
            password: "12345"
          }
        end

        it "sets #encryption with TPM_FDE method to the newly formatted partitions" do
          config = subject.convert
          partitions = config.partitions
          new_partitions = partitions.reject(&:search)
          new_non_boot_partitions = new_partitions.reject do |part|
            part.filesystem&.path == "/boot/efi"
          end

          expect(new_non_boot_partitions.map { |p| p.encryption.method.id }).to all(eq(:tpm_fde))
          expect(new_non_boot_partitions.map { |p| p.encryption.password }).to all(eq("12345"))
        end

        it "sets #encryption with TPM_FDE method for the automatically created physical volumes" do
          config = subject.convert
          volume_group = config.volume_groups.first
          target_encryption = volume_group.physical_volumes_encryption

          expect(target_encryption.method.id).to eq(:tpm_fde)
          expect(target_encryption.password).to eq("12345")
        end
      end

      context "with TPM and grub2-bls bootloader" do
        let(:bootloader_config) do
          config = Agama::Storage::BootloaderConfig.new
          config.type = Y2Storage::BootloaderType::GRUB2_BLS
          config
        end

        let(:encryption) do
          {
            tpm:      true,
            password: "12345"
          }
        end

        it "sets #encryption with TPM_BLS method to the newly formatted partitions" do
          config = subject.convert
          partitions = config.partitions
          new_partitions = partitions.reject(&:search)
          new_non_boot_partitions = new_partitions.reject do |part|
            part.filesystem&.path == "/boot/efi"
          end

          expect(new_non_boot_partitions.map do |p|
                   p.encryption.method.id
                 end).to all(eq(:tpm_bls))
          expect(new_non_boot_partitions.map { |p| p.encryption.password }).to all(eq("12345"))
        end

        it "sets #encryption with TPM_BLS method for the automatically created physical " \
           "volumes" do
          config = subject.convert
          volume_group = config.volume_groups.first
          target_encryption = volume_group.physical_volumes_encryption

          expect(target_encryption.method.id).to eq(:tpm_bls)
          expect(target_encryption.password).to eq("12345")
        end
      end

      context "with TPM and systemd-boot bootloader" do
        let(:bootloader_config) do
          config = Agama::Storage::BootloaderConfig.new
          config.type = Y2Storage::BootloaderType::SYSTEMD_BOOT
          config
        end

        let(:encryption) do
          {
            tpm:      true,
            password: "12345"
          }
        end

        it "sets #encryption with TPM_BLS method to the newly formatted partitions" do
          config = subject.convert
          partitions = config.partitions
          new_partitions = partitions.reject(&:search)
          new_non_boot_partitions = new_partitions.reject do |part|
            part.filesystem&.path == "/boot/efi"
          end

          expect(new_non_boot_partitions.map do |p|
                   p.encryption.method.id
                 end).to all(eq(:tpm_bls))
          expect(new_non_boot_partitions.map { |p| p.encryption.password }).to all(eq("12345"))
        end

        it "sets #encryption with TPM_BLS method for the automatically created physical " \
           "volumes" do
          config = subject.convert
          volume_group = config.volume_groups.first
          target_encryption = volume_group.physical_volumes_encryption

          expect(target_encryption.method.id).to eq(:tpm_bls)
          expect(target_encryption.password).to eq("12345")
        end
      end
    end
  end
end
