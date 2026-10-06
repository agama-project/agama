#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016-2023] SUSE LLC
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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage"

describe Y2Storage::Proposal::SpaceMaker do
  include_context "yast2-storage-ng test setup"

  # Partition from fake_devicegraph, fetched by name
  def probed_partition(name)
    fake_devicegraph.partitions.detect { |p| p.name == name }
  end

  before do
    fake_scenario(scenario)
    allow(analyzer).to receive(:windows_partitions).and_return windows_partitions
  end

  let(:space_settings) do
    Y2Storage::ProposalSpaceSettings.new.tap do |settings|
      settings.resize_windows = resize_windows
      settings.windows_delete_mode = delete_windows
      settings.linux_delete_mode = delete_linux
      settings.other_delete_mode = delete_other
    end
  end
  # Default values for settings
  let(:resize_windows) { true }
  let(:delete_windows) { :ondemand }
  let(:delete_linux) { :ondemand }
  let(:delete_other) { :ondemand }
  let(:disks) { ["/dev/sda"] }

  let(:analyzer) { Y2Storage::DiskAnalyzer.new(fake_devicegraph) }
  let(:windows_partitions) { [] }

  subject(:maker) { described_class.new(analyzer, space_settings) }

  describe "#prepare_devicegraph" do
    let(:scenario) { "complex-lvm-encrypt" }

    context "if a given delete_mode is :none" do
      let(:delete_linux) { :none }

      it "does not delete the affected partitions" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.size).to eq fake_devicegraph.partitions.size
      end
    end

    context "if a given delete_mode is :ondemand" do
      let(:delete_linux) { :ondemand }

      it "does not delete the affected partitions" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.size).to eq fake_devicegraph.partitions.size
      end
    end

    context "if a given delete_mode is :all" do
      let(:delete_linux) { :all }

      it "does not delete partitions out of SpaceMaker#candidate_devices" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to include "/dev/sde1", "/dev/sde2", "/dev/sdf1"
      end

      it "deletes affected partitions within the candidate devices" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to_not include "/dev/sda2", "/dev/sda3", "/dev/sda4"
      end
    end

    context "when deleting Linux partitions" do
      let(:delete_linux) { :all }

      let(:disks) { fake_devicegraph.disks.map(&:name) }

      it "deletes partitions with id linux" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to_not include "/dev/sda2", "/dev/sda4", "/dev/sde1"
      end

      it "deletes partitions with id swap" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to_not include "/dev/sde3"
      end

      it "deletes partitions with id lvm" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to_not include "/dev/sda3", "/dev/sde2"
      end

      it "deletes partitions with id raid" do
        skip "Let's wait until we have some meaningful RAID scenarios"
      end

      it "does not delete any other partition" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.size).to eq 2
      end
    end

    context "when deleting Windows partitions" do
      let(:delete_windows) { :all }
      let(:scenario) { "windows-linux-lvm-pc-gpt" }
      let(:windows_partitions) { [partition_double("/dev/sda2")] }

      it "deletes partitions that seem to contain a Windows system" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to_not include "/dev/sda2"
      end

      it "does not delete NTFS/FAT partitions that don't look like a bootable Windows system" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to include "/dev/sda4"
      end

      it "does not delete Linux partitions" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to include "/dev/sda3"
      end

      it "does not delete other partitions like the Grub one" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to include "/dev/sda1"
      end
    end

    context "when deleting other partitions" do
      let(:delete_other) { :all }
      let(:scenario) { "windows-linux-lvm-pc-gpt" }
      let(:windows_partitions) { [partition_double("/dev/sda2")] }

      it "deletes all partitions except those included in the Windows or Linux definitions" do
        result = maker.prepare_devicegraph(fake_devicegraph, disks)
        expect(result.partitions.map(&:name)).to contain_exactly "/dev/sda2", "/dev/sda3"
      end
    end

    context "when deleting a btrfs partition that is part of a multidevice btrfs" do
      let(:scenario) { "btrfs-multidevice-over-partitions.xml" }
      let(:delete_linux) { :all }

      it "deletes all partitions constituting this btrfs" do
        result = maker.prepare_devicegraph(fake_devicegraph, ["/dev/sda", "/dev/sdb"])
        expect(result.partitions.map(&:name)).to be_empty
      end

      it "but deletes only partitions on candidate devices" do
        result = maker.prepare_devicegraph(fake_devicegraph, ["/dev/sda"])
        expect(result.partitions.map(&:name)).to contain_exactly "/dev/sdb1", "/dev/sdb2", "/dev/sdb3"
      end
    end

    context "when deleting a partition that is part of a raid" do
      let(:scenario) { "raid0-over-partitions.xml" }
      let(:delete_linux) { :all }

      it "deletes all partitions constituting this raid" do
        result = maker.prepare_devicegraph(fake_devicegraph, ["/dev/sda", "/dev/sdb"])
        expect(result.partitions.map(&:name)).to be_empty
      end

      it "but deletes only partitions on candidate devices" do
        result = maker.prepare_devicegraph(fake_devicegraph, ["/dev/sda"])
        expect(result.partitions.map(&:name)).to contain_exactly "/dev/sdb1", "/dev/sdb2", "/dev/sdb3"
      end
    end

    context "when deleting a partition that is part of a lvm volume group" do
      let(:scenario) { "lvm-over-partitions.xml" }
      let(:delete_linux) { :all }

      it "deletes all partitions constituting this volume group" do
        result = maker.prepare_devicegraph(fake_devicegraph, ["/dev/sda", "/dev/sdb"])
        expect(result.partitions.map(&:name)).to be_empty
      end

      it "but deletes only partitions on candidate devices" do
        result = maker.prepare_devicegraph(fake_devicegraph, ["/dev/sda"])
        expect(result.partitions.map(&:name)).to contain_exactly "/dev/sdb1", "/dev/sdb2", "/dev/sdb3"
      end
    end
  end

  describe "#provide_space" do
    using Y2Storage::Refinements::SizeCasts

    let(:volumes) { [vol1] }

    context "if the only disk is not big enough" do
      let(:scenario) { "empty_hard_disk_mbr_50GiB" }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 60.GiB) }

      it "raises an Error exception" do
        expect { maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks) }
          .to raise_error Y2Storage::Error
      end
    end

    context "if the only disk has no partition table and is not used in any other way" do
      let(:scenario) { "empty_hard_disk_50GiB" }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 40.GiB) }

      it "does not modify the disk" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        disk = result[:devicegraph].disks.first
        expect(disk.partition_table).to be_nil
      end

      it "assumes a (future) GPT partition table" do
        gpt_size = 1.MiB
        # The final 16.5 KiB are reserved by GPT
        gpt_final_space = 16.5.KiB

        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        space = result[:partitions_distribution].spaces.first
        expect(space.disk_size).to eq(50.GiB - gpt_size - gpt_final_space)
      end
    end

    context "if the only disk is directly used as PV (no partition table)" do
      let(:scenario) { "lvm-disk-as-pv.xml" }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 5.GiB) }

      it "empties the disk deleting the LVM VG" do
        expect(fake_devicegraph.lvm_vgs.size).to eq 1

        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        disk = result[:devicegraph].disks.first
        expect(disk.has_children?).to eq false
        expect(result[:devicegraph].lvm_vgs).to be_empty
      end

      it "assumes a (future) GPT partition table" do
        gpt_size = 1.MiB
        # The final 16.5 KiB are reserved by GPT
        gpt_final_space = 16.5.KiB

        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        space = result[:partitions_distribution].spaces.first
        expect(space.disk_size).to eq(space.disk.size - gpt_size - gpt_final_space)
      end
    end

    context "if the only available device is directly formatted (no partition table)" do
      let(:scenario) { "multipath-formatted.xml" }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 5.GiB) }

      let(:disks) { ["/dev/mapper/0QEMU_QEMU_HARDDISK_mpath1"] }

      it "empties the device deleting the filesystem" do
        expect(fake_devicegraph.filesystems.size).to eq 1

        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        disk = result[:devicegraph].disk_devices.first
        expect(disk.has_children?).to eq false
        expect(result[:devicegraph].filesystems).to be_empty
      end

      it "assumes a (future) GPT partition table" do
        gpt_size = 1.MiB
        # The final 16.5 KiB are reserved by GPT
        gpt_final_space = 16.5.KiB

        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        space = result[:partitions_distribution].spaces.first
        expect(space.disk_size).to eq(space.disk.size - gpt_size - gpt_final_space)
      end
    end

    context "with one disk containing Windows and Linux partitions" do
      let(:scenario) { "windows-linux-multiboot-pc" }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 100.GiB) }
      let(:windows_partitions) { [partition_double("/dev/sda1")] }

      context "if deleting Linux partitions is allowed" do
        let(:delete_linux) { :ondemand }

        it "deletes linux partitions as needed" do
          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          expect(result[:devicegraph].partitions).to contain_exactly(
            an_object_having_attributes(filesystem_label: "windows", size: 250.GiB),
            an_object_having_attributes(filesystem_label: "swap", size: 2.GiB)
          )
        end

        it "stores the list of deleted partitions" do
          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          expect(result[:deleted_partitions]).to contain_exactly(
            an_object_having_attributes(filesystem_label: "root", size: 248.GiB - 1.MiB)
          )
        end

        it "suggests a distribution using the freed space" do
          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          distribution = result[:partitions_distribution]
          expect(distribution.spaces.size).to eq 1
          expect(distribution.spaces.first.partitions).to eq volumes
        end

        context "if deleting Linux is not enough" do
          let(:vol2) { planned_vol(mount_point: "/2", type: :ext4, min: 200.GiB) }
          let(:volumes) { [vol1, vol2] }

          context "if resizing Windows is allowed" do
            let(:resize_windows) { true }
            let(:resize_info) do
              instance_double("ResizeInfo", resize_ok?: true, min_size: 100.GiB, max_size: 800.GiB)
            end

            before do
              allow_any_instance_of(Y2Storage::Partition)
                .to receive(:detect_resize_info).and_return(resize_info)
            end

            it "resizes Windows partitions to free additional needed space" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              expect(result[:devicegraph].partitions).to contain_exactly(
                an_object_having_attributes(filesystem_label: "windows", size: 200.GiB - 1.MiB)
              )
            end
          end

          context "if resizing Windows is not allowed but deleting Windows is" do
            let(:resize_windows) { false }
            let(:delete_windows) { :ondemand }

            it "deletes Windows partitions as needed" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              expect(result[:devicegraph].partitions).to be_empty
            end

            it "stores the list of deleted partitions" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              expect(result[:deleted_partitions]).to contain_exactly(
                an_object_having_attributes(name: "/dev/sda1"),
                an_object_having_attributes(name: "/dev/sda2"),
                an_object_having_attributes(name: "/dev/sda3")
              )
            end

            it "suggests a distribution using the freed space" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              distribution = result[:partitions_distribution]
              expect(distribution.spaces.size).to eq 1
              expect(distribution.spaces.first.partitions).to eq volumes
            end
          end

          context "if no resizing or deleting of Windows is allowed" do
            let(:resize_windows) { false }
            let(:delete_windows) { :none }

            it "raises an Error exception" do
              expect { maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks) }
                .to raise_error Y2Storage::Error
            end
          end
        end
      end

      context "if deleting Linux partitions is not allowed" do
        let(:delete_linux) { :none }

        context "if resizing Windows is allowed" do
          let(:resize_windows) { true }
          let(:resize_info) do
            instance_double("ResizeInfo", resize_ok?: true, min_size: 100.GiB, max_size: 800.GiB)
          end

          before do
            allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
              .and_return(resize_info)
          end

          it "does not delete the Linux partitions" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            expect(result[:devicegraph].partitions.map(&:filesystem_label)).to include("root", "swap")
          end

          it "resizes Windows partitions to free additional needed space" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            windows = result[:devicegraph].partitions.detect { |p| p.filesystem_label == "windows" }
            expect(windows.size).to eq 150.GiB
          end
        end

        context "if resizing Windows is not allowed but deleting Windows is" do
          let(:resize_windows) { false }
          let(:delete_windows) { :ondemand }

          it "does not delete the Linux partitions" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            expect(result[:devicegraph].partitions.map(&:filesystem_label)).to include("root", "swap")
          end

          it "deletes Windows partitions as needed" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            windows = result[:devicegraph].partitions.detect { |p| p.filesystem_label == "windows" }
            expect(windows).to be_nil
          end

          it "stores the list of deleted partitions" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            expect(result[:deleted_partitions]).to contain_exactly(
              an_object_having_attributes(name: "/dev/sda1")
            )
          end
        end

        context "if no resizing or deleting of Windows is allowed" do
          let(:resize_windows) { false }
          let(:delete_windows) { :none }

          it "raises an Error exception" do
            expect { maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks) }
              .to raise_error Y2Storage::Error
          end
        end
      end
    end

    context "with one disk containing a Windows partition and no Linux ones" do
      let(:scenario) { "windows-pc" }
      let(:resize_info) do
        instance_double("Y2Storage::ResizeInfo", resize_ok?: true, min_size: 730.GiB, max_size: 800.GiB,
          reasons: 0, reason_texts: [])
      end
      let(:windows_partitions) { [partition_double("/dev/sda1")] }

      before do
        allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
          .and_return(resize_info)
      end

      context "if resizing Windows is allowed" do
        let(:resize_windows) { true }

        context "with enough free space in the Windows partition" do
          let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 40.GiB) }

          it "shrinks the Windows partition by the required size" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            win_partition = Y2Storage::Partition.find_by_name(result[:devicegraph], "/dev/sda1")
            expect(win_partition.size).to eq 740.GiB
          end

          it "leaves other partitions untouched" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            expect(result[:devicegraph].partitions).to contain_exactly(
              an_object_having_attributes(filesystem_label: "windows"),
              an_object_having_attributes(filesystem_label: "recovery", size: 20.GiB - 1.MiB)
            )
          end

          it "leaves empty the list of deleted partitions" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            expect(result[:deleted_partitions]).to be_empty
          end

          it "suggests a distribution using the freed space" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            distribution = result[:partitions_distribution]
            expect(distribution.spaces.size).to eq 1
            expect(distribution.spaces.first.partitions).to eq volumes
          end
        end

        context "with no enough free space in the Windows partition" do
          let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 60.GiB) }

          context "if deleting other (no Windows or Linux) partitions is allowed" do
            let(:delete_other) { :ondemand }

            it "shrinks the Windows partition as much as possible" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              win_partition = Y2Storage::Partition.find_by_name(result[:devicegraph], "/dev/sda1")
              expect(win_partition.size).to eq 730.GiB
            end

            it "removes other (no Windows or Linux) partitions as needed" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              expect(result[:devicegraph].partitions).to contain_exactly(
                an_object_having_attributes(filesystem_label: "windows")
              )
            end

            it "stores the list of deleted partitions" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              expect(result[:deleted_partitions]).to contain_exactly(
                an_object_having_attributes(filesystem_label: "recovery", size: 20.GiB - 1.MiB)
              )
            end

            it "suggests a distribution using the freed space" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              distribution = result[:partitions_distribution]
              expect(distribution.spaces.size).to eq 1
              expect(distribution.spaces.first.partitions).to eq volumes
            end
          end

          context "if deleting other (no Windows or Linux) partitions is not allowed" do
            let(:delete_other) { :none }

            context "if deleting Windows is allowed" do
              let(:delete_windows) { :ondemand }

              it "deletes Windows partitions as needed" do
                result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
                windows = result[:devicegraph].partitions.detect { |p| p.filesystem_label == "windows" }
                expect(windows).to be_nil
              end

              it "does not remove other (no Windows or Linux) partitions" do
                result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
                expect(result[:devicegraph].partitions.map(&:filesystem_label)).to include "recovery"
              end

              it "stores the list of deleted partitions" do
                result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
                expect(result[:deleted_partitions]).to contain_exactly(
                  an_object_having_attributes(filesystem_label: "windows")
                )
              end

              it "suggests a distribution using the freed space" do
                result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
                distribution = result[:partitions_distribution]
                expect(distribution.spaces.size).to eq 1
                expect(distribution.spaces.first.partitions).to eq volumes
              end
            end

            context "if deleting Windows not is allowed" do
              let(:delete_windows) { :none }

              it "raises an Error exception" do
                expect do
                  maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
                end.to raise_error Y2Storage::Error
              end
            end
          end
        end
      end

      context "if resizing Windows is not allowed" do
        let(:resize_windows) { false }
        let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 18.GiB) }

        context "if deleting other (no Windows or Linux) partitions is allowed" do
          let(:delete_other) { :ondemand }

          it "removes other (no Windows or Linux) partitions as needed" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            expect(result[:devicegraph].partitions).to contain_exactly(
              an_object_having_attributes(filesystem_label: "windows")
            )
          end

          it "stores the list of deleted partitions" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            expect(result[:deleted_partitions]).to contain_exactly(
              an_object_having_attributes(filesystem_label: "recovery", size: 20.GiB - 1.MiB)
            )
          end

          it "suggests a distribution using the freed space" do
            result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
            distribution = result[:partitions_distribution]
            expect(distribution.spaces.size).to eq 1
            expect(distribution.spaces.first.partitions).to eq volumes
          end
        end

        context "if deleting other (no Windows or Linux) partitions is not allowed" do
          let(:delete_other) { :none }

          context "if deleting Windows is allowed" do
            let(:delete_windows) { :ondemand }

            it "deletes Windows partition as needed" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              windows = result[:devicegraph].partitions.detect { |p| p.filesystem_label == "windows" }
              expect(windows).to be_nil
            end

            it "does not remove other (no Windows or Linux) partitions" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              expect(result[:devicegraph].partitions.map(&:filesystem_label)).to include "recovery"
            end

            it "stores the list of deleted partitions" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              expect(result[:deleted_partitions]).to contain_exactly(
                an_object_having_attributes(filesystem_label: "windows")
              )
            end

            it "suggests a distribution using the freed space" do
              result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
              distribution = result[:partitions_distribution]
              expect(distribution.spaces.size).to eq 1
              expect(distribution.spaces.first.partitions).to eq volumes
            end
          end

          context "if deleting Windows is not allowed" do
            let(:delete_windows) { :none }

            it "raises an Error exception" do
              expect { maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks) }
                .to raise_error Y2Storage::Error
            end
          end
        end
      end
    end

    # A partition on a RAID and a partition on a plain disk are treated
    # differently (bsc#1139808) - see comment in Partition#disk.
    #
    context "with one RAID1 containing a single resizable Windows partition" do
      let(:scenario) { "windows-pc-raid1.xml" }
      let(:resize_info) do
        instance_double("Y2Storage::ResizeInfo", resize_ok?: true, min_size: 1.GiB, max_size: 60.GiB,
          reasons: 0, reason_texts: [])
      end
      let(:windows_partitions) { [partition_double("/dev/md0p1")] }
      let(:resize_windows) { true }
      let(:disks) { ["/dev/md0"] }

      before do
        allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
          .and_return(resize_info)
      end

      context "with enough free space in the Windows partition" do
        let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 40.GiB) }

        it "shrinks the Windows partition by the required size" do
          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          win_partition = Y2Storage::Partition.find_by_name(result[:devicegraph], "/dev/md0p1")
          expect(win_partition.size).to eq 20.GiB - 35.MiB
        end

        it "suggests a distribution using the freed space" do
          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          distribution = result[:partitions_distribution]
          expect(distribution.spaces.size).to eq 1
          expect(distribution.spaces.first.partitions).to eq volumes
        end
      end
    end

    context "if there are two Windows partitions" do
      let(:scenario) { "double-windows-pc" }
      let(:resize_info) do
        instance_double("Y2Storage::ResizeInfo", resize_ok?: true, min_size: 50.GiB, max_size: 800.GiB,
          reasons: 0, reason_texts: [])
      end
      let(:windows_partitions) do
        [
          partition_double("/dev/sda1"),
          partition_double("/dev/sdb1")
        ]
      end
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 20.GiB) }
      let(:disks) { ["/dev/sda", "/dev/sdb"] }

      before do
        allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
          .and_return(resize_info)
      end

      it "shrinks first the less full Windows partition" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        win2_partition = Y2Storage::Partition.find_by_name(result[:devicegraph], "/dev/sdb1")
        expect(win2_partition.size).to eq 160.GiB
      end

      it "leaves other partitions untouched if possible" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        expect(result[:devicegraph].partitions).to contain_exactly(
          an_object_having_attributes(filesystem_label: "windows1", size: 80.GiB),
          an_object_having_attributes(filesystem_label: "recovery1", size: 20.GiB - 1.MiB),
          an_object_having_attributes(filesystem_label: "windows2"),
          an_object_having_attributes(filesystem_label: "recovery2", size: 20.GiB - 1.MiB)
        )
      end
    end

    context "when forced to delete partitions" do
      let(:scenario) { "multi-linux-pc" }

      it "deletes the last partitions of the disk until reaching the goal" do
        vol = planned_vol(mount_point: "/1", type: :ext4, min: 700.GiB)
        volumes = [vol]

        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        expect(result[:deleted_partitions]).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda4", size: 900.GiB - 1.MiB),
          an_object_having_attributes(name: "/dev/sda5", size: 300.GiB),
          an_object_having_attributes(name: "/dev/sda6", size: 600.GiB - 3.MiB)
        )
        expect(result[:devicegraph].partitions).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda1", size: 4.GiB),
          an_object_having_attributes(name: "/dev/sda2", size: 60.GiB),
          an_object_having_attributes(name: "/dev/sda3", size: 60.GiB)
        )
      end

      it "raises an Error exception if deleting is not enough" do
        vol1 = planned_vol(mount_point: "/1", type: :ext4, min: 980.GiB)
        maker.protected_sids = [probed_partition("/dev/sda2").sid]

        expect { maker.provide_space(fake_devicegraph, partitions: [vol1], default_disks: disks) }
          .to raise_error Y2Storage::Error
      end

      it "deletes extended partitions when deleting all its logical children" do
        volumes = [
          planned_vol(mount_point: "/1", type: :ext4, min: 800.GiB),
          planned_vol(mount_point: "/2", reuse_name: "/dev/sda1"),
          planned_vol(mount_point: "/2", reuse_name: "/dev/sda2"),
          planned_vol(mount_point: "/2", reuse_name: "/dev/sda3")
        ]

        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        expect(result[:devicegraph].partitions).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda1", size: 4.GiB),
          an_object_having_attributes(name: "/dev/sda2", size: 60.GiB),
          an_object_having_attributes(name: "/dev/sda3", size: 60.GiB)
        )
        expect(result[:deleted_partitions]).to contain_exactly(
          an_object_having_attributes(name: "/dev/sda4"),
          an_object_having_attributes(name: "/dev/sda5"),
          an_object_having_attributes(name: "/dev/sda6")
        )
      end

      # In the past, SpaceMaker used to delete the extended partition sda4
      # leaving sda6 alive. This test ensures the bug does not re-appear
      it "does not delete the extended partition if some logical one is to be reused" do
        volumes = [planned_vol(mount_point: "/1", type: :ext4, min: 400.GiB)]
        maker.protected_sids = [
          probed_partition("/dev/sda1").sid,
          probed_partition("/dev/sda2").sid,
          probed_partition("/dev/sda3").sid,
          probed_partition("/dev/sda6").sid
        ]

        expect { maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks) }
          .to raise_error Y2Storage::Error
      end
    end

    context "when some volumes have disk restrictions" do
      let(:scenario) { "mixed_disks" }
      let(:resize_info) do
        instance_double("Y2Storage::ResizeInfo", resize_ok?: true, min_size: 50.GiB, max_size: 800.GiB,
          reasons: 0, reason_texts: [])
      end
      let(:windows_partitions) { [partition_double("/dev/sda1")] }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, disk: "/dev/sda") }
      let(:vol2) { planned_vol(mount_point: "/2", type: :ext4, disk: "/dev/sda") }
      let(:vol3) { planned_vol(mount_point: "/3", type: :ext4) }
      let(:volumes) { [vol1, vol2, vol3] }
      let(:disks) { ["/dev/sda", "/dev/sdb"] }

      before do
        allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
          .and_return(resize_info)
      end

      context "if the choosen disk has no enough space" do
        before do
          vol1.min_size = 101.GiB
          vol2.min_size = 100.GiB
          vol3.min_size = 1.GiB
        end

        it "raises an exception even if there is enough space in other disks" do
          expect { maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks) }
            .to raise_error Y2Storage::Error
        end
      end

      context "if several disks can allocate the volumes" do
        before do
          vol1.min_size = 60.GiB
          vol2.min_size = 60.GiB
          vol3.min_size = 1.GiB
        end

        it "ensures disk restrictions are honored" do
          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          distribution = result[:partitions_distribution]
          sda_space = distribution.spaces.detect { |i| i.disk_name == "/dev/sda" }
          # Without disk restrictions, it would have deleted linux partitions at /dev/sdb and
          # allocated the volumes there
          expect(sda_space.partitions).to include vol1
          expect(sda_space.partitions).to include vol2
        end

        it "applies the usual criteria to allocate non-restricted volumes" do
          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          distribution = result[:partitions_distribution]
          sdb_space = distribution.spaces.detect { |i| i.disk_name == "/dev/sdb" }
          # Default action: delete linux partitions at /dev/sdb and allocate volumes there
          expect(sdb_space.partitions).to include vol3
        end
      end
    end

    context "when deleting a partition from an implicit partition table" do
      let(:scenario) { "several-dasds" }

      let(:volumes) { [planned_vol(mount_point: "/1", type: :ext4, min: 2.GiB)] }

      let(:dasda) { fake_devicegraph.find_by_name("/dev/dasda") }

      let(:partition) { dasda.partition_table.partition }

      let(:disks) { ["/dev/dasda"] }

      it "does not remove the partitition" do
        original_partition = partition
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        partitions = result[:devicegraph].partitions

        expect(partitions.map(&:sid)).to include original_partition.sid
      end

      context "if the partition is not empty" do
        before do
          partition.create_filesystem(Y2Storage::Filesystems::Type::EXT3)
        end

        it "wipes the partition" do
          expect(partition.has_children?).to eq(true)

          result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
          dasda = result[:devicegraph].find_by_name("/dev/dasda")
          partition = dasda.partition_table.partition

          expect(partition.has_children?).to eq(false)
        end
      end
    end

    context "when deleting a partition which belongs to a LVM" do
      let(:scenario) { "lvm-two-vgs" }
      let(:windows_partitions) { [partition_double("/dev/sda1")] }
      let(:volumes) { [planned_vol(mount_point: "/1", type: :ext4, min: 2.GiB)] }

      it "deletes also other partitions of the same volume group" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        partitions = result[:devicegraph].partitions

        expect(partitions.map(&:sid)).to_not include probed_partition("/dev/sda9").sid
        expect(partitions.map(&:sid)).to_not include probed_partition("/dev/sda5").sid
      end

      it "deletes the volume group itself" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)

        expect(result[:devicegraph].lvm_vgs.map(&:vg_name)).to_not include "vg1"
      end

      it "does not affect partitions from other volume groups" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        devicegraph = result[:devicegraph]

        expect(devicegraph.partitions.map(&:name)).to include "/dev/sda7"
        expect(devicegraph.lvm_vgs.map(&:vg_name)).to include "vg0"
      end
    end

    context "when a Windows partition needs to be resized" do
      let(:scenario) { "windows-pc-gpt-with-gap" }
      let(:resize_info) do
        instance_double("Y2Storage::ResizeInfo", resize_ok?: true, min_size: 50.GiB, max_size: 780.GiB,
          reasons: 0, reason_texts: [])
      end
      let(:windows_partitions) { [partition_double("/dev/sda2")] }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 20.GiB) }

      before do
        allow_any_instance_of(Y2Storage::Partition).to receive(:detect_resize_info)
          .and_return(resize_info)
      end

      # Regression test for bsc#1121286. In the past, the gap existing between the
      # "recovery" and "windows" partitions confused SpaceMaker, which tried to
      # reduce the Windows less than really needed. As a consequence, SpaceMaker
      # wrongly concluded that reducing "windows" was not enough and it ended up
      # deleting it.
      it "does not delete the Windows partition if resizing is enough" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        devicegraph = result[:devicegraph]
        expect(devicegraph.partitions.size).to eq 2
      end

      # Regression test for bsc#1121286. In the past, the end of the resulting partition
      # was misaligned by -16.5 KiB, something that is mandatory when the
      # partition extends up to the end of the GPT disk, but that should have been
      # fixed while resizing it (otherwise we will have two 16.5 KiB gaps after creating
      # the partitions - the mandatory one that will reappear at the end of the disk
      # and the one at the end of the partition labeled "windows").
      it "aligns the new end of the partition" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        ptable = result[:devicegraph].disks.first.partition_table
        aligned = ptable.partitions.map { |part| part.region.end_aligned?(ptable.align_grain) }
        expect(aligned).to eq [true, true]
      end
    end

    # Test for bug#1161331 found in the beta versions of SLE-15-SP2. Instead of just
    # doing its work, this scenario made SpaceMaker enter an infinite loop trying to
    # delete sda1 over and over again.
    context "when a planned device needs to be created out of the candidate devices" do
      let(:scenario) { "empty-md_raid" }
      let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 200.GiB, disk: "/dev/sda") }
      let(:disks) { fake_devicegraph.raids.map(&:name) }

      it "makes space for it" do
        result = maker.provide_space(fake_devicegraph, partitions: volumes, default_disks: disks)
        devicegraph = result[:devicegraph]
        expect(devicegraph.partitions.size).to eq 1
      end
    end
  end
end
