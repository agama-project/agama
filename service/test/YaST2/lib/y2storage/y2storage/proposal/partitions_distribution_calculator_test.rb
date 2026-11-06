#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2016] SUSE LLC
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

require "storage"
require "y2storage"

describe Y2Storage::Proposal::PartitionsDistributionCalculator do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  let(:lvm_volumes) { [] }
  let(:settings) { Y2Storage::ProposalSettings.new }
  let(:enc_password) { nil }
  let(:lvm_vg_strategy) { :use_needed }
  let(:lvm_helper) { Y2Storage::Proposal::LvmHelper.new(lvm_volumes, settings) }
  let(:planned_vg) { lvm_helper.volume_group }
  let(:disks) { fake_devicegraph.disk_devices.map(&:name) }

  before do
    settings.encryption_password = enc_password
    settings.lvm_vg_strategy = lvm_vg_strategy
    fake_scenario(scenario)
  end

  subject(:calculator) { described_class.new(volumes, [planned_vg], disks) }

  describe "#best_distribution" do
    let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 1.GiB, max: 3.GiB, weight: 1) }
    let(:vol2) { planned_vol(mount_point: "/2", type: :ext4, min: 2.GiB, max: 3.GiB, weight: 1) }
    let(:volumes) { [vol1, vol2, vol3] }
    let(:spaces) { fake_devicegraph.free_spaces }

    subject(:distribution) { calculator.best_distribution(spaces) }

    let(:pv_vols) do
      volumes = distribution.spaces.map(&:partitions)
      volumes.map { |vols| vols.select(&:lvm_pv?) }.flatten
    end

    context "when the only available space is in an extended partition" do
      let(:scenario) { "space_22_extended" }

      context "if the space is not big enough" do
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 30.GiB, max: 30.GiB) }

        it "returns no distribution (nil)" do
          expect(distribution).to be_nil
        end
      end

      context "if the space is big enough" do
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 3.GiB, max: 3.GiB) }

        it "uses align grain to properly allocate partitions" do
          expect(spaces.first).to receive(:align_grain).at_least(:once)
          subject
        end

        it "allocates all the volumes in the available space" do
          spaces = distribution.spaces
          expect(spaces.size).to eq 1
          expect(spaces.first.partitions).to contain_exactly(vol1, vol2, vol3)
        end

        it "sets the partition type to :logical" do
          space = distribution.spaces.first
          expect(space.partition_type).to eq :logical
        end

        it "plans all the partitions as logical" do
          space = distribution.spaces.first
          expect(space.num_logical).to eq space.partitions.size
        end

        context "if any of the planned partitions must be primary" do
          before { vol3.primary = true }

          it "returns no distribution (nil)" do
            expect(distribution).to be_nil
          end
        end
      end
    end

    context "when the only available space is unassigned (ms-dos partition table)" do
      let(:scenario) { "space_22" }

      context "if the space is not big enough" do
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 30.GiB, max: 30.GiB) }

        it "returns no distribution (nil)" do
          expect(distribution).to be_nil
        end
      end

      context "if the space is big enough" do
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 19.GiB - 2.MiB) }

        it "allocates all the volumes in the available space" do
          spaces = distribution.spaces
          expect(spaces.size).to eq 1
          expect(spaces.first.partitions).to contain_exactly(vol1, vol2, vol3)
        end

        it "keeps the order of the planned partitions" do
          space = distribution.spaces.first
          expect(space.partitions).to eq [vol1, vol2, vol3]
        end

        context "and there is no extended partition" do
          it "does not set the partition type" do
            space = distribution.spaces.first
            expect(space.partition_type).to be_nil
          end

          it "plans the surplus partitions as logical" do
            space = distribution.spaces.first
            expect(space.num_logical).to eq 2
          end

          it "keeps the order of the planned partitions" do
            space = distribution.spaces.first
            expect(space.partitions).to eq [vol1, vol2, vol3]
          end

          context "if some planned partition must be primary" do
            context "and it is in the area assigned to primary partitions" do
              before { vol1.primary = true }

              it "returns a valid distribution" do
                expect(distribution).to_not be_nil
              end

              it "keeps the order of the planned partitions" do
                space = distribution.spaces.first
                expect(space.partitions).to eq [vol1, vol2, vol3]
              end
            end

            context "and it is in the area assigned to logical partitions" do
              before { vol2.primary = true }

              it "returns no distribution (nil)" do
                expect(distribution).to be_nil
              end
            end
          end
        end

        context "if the space does not have extra room for the EBRs" do
          let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 19.GiB) }

          it "returns no distribution (nil)" do
            expect(distribution).to be_nil
          end
        end

        context "and there is already a extended partition" do
          let(:scenario) { "space_22_used_extended" }

          context "and the number of partitions exceeds the primary limit" do
            it "returns no distribution (nil)" do
              expect(distribution).to be_nil
            end
          end

          context "and there are not too many primary partitions already" do
            let(:volumes) { [vol1, vol2] }

            it "sets partition_type to primary" do
              spaces = distribution.spaces
              expect(spaces.first.partition_type).to eq :primary
            end

            it "plans no logical partitions" do
              space = distribution.spaces.first
              expect(space.num_logical).to eq 0
            end

            it "keeps the order of the planned partitions" do
              space = distribution.spaces.first
              expect(space.partitions).to eq [vol1, vol2]
            end

            context "even if the last partition is compulsorily primary" do
              before { vol2.primary = true }

              it "keeps the order of the planned partitions" do
                space = distribution.spaces.first
                expect(space.partitions).to eq [vol1, vol2]
              end
            end
          end
        end
      end
    end

    context "when there are several free spaces" do
      let(:scenario) { "spaces_5_3" }

      context "if the sum of all spaces is not big enough" do
        let(:scenario) { "spaces_5_6_8_10" }
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 30.GiB, max: 30.GiB) }

        it "returns no distribution (nil)" do
          expect(distribution).to be_nil
        end
      end

      context "if only one distribution ensures that not gaps will be introduced" do
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 3.GiB, max: 5.GiB - 1.MiB) }

        before { vol1.max = 2.GiB }

        it "returns that best distribution" do
          expect(distribution.gaps_count).to eq 0
          expect(distribution.gaps_total_size).to eq(Y2Storage::DiskSize.zero)
          expect(spaces.size).to eq(2)
        end
      end

      context "if one distribution creates smaller gaps than the others" do
        let(:scenario) { "spaces_4_4" }
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 3.GiB, max: 3.GiB) }

        it "returns that best distribution" do
          expect(distribution.gaps_total_size).to eq 1021.MiB
        end
      end

      context "if there are several distributions that wouldn't introduce gaps" do
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 3.GiB, max: 3.GiB) }

        context "but one has better distributed weights (lower #weight_space_deviation)" do
          it "returns that best distribution" do
            # The expected distribution is: vol1 and vol3 to the first space
            grouping = distribution.spaces.map(&:partitions)
            expect(grouping).to eq [[vol1, vol3], [vol2]]
          end
        end

        context "with an equivalent distribution of weights (#weight_space_deviation)" do
          let(:vol1) do
            planned_vol(mount_point: "/1", type: :ext4, min: 1.GiB, max: 1.GiB, weight: 0)
          end

          let(:vol2) do
            planned_vol(mount_point: "/2", type: :ext4, min: 2.GiB, max: 2.GiB, weight: 0)
          end

          let(:volumes) { [vol1, vol2] }

          it "returns the distribution in which the new partitions are more grouped" do
            # The expected distribution is: everything in the 3 GiB space
            expect(distribution.spaces.size).to eq 1
            expect(distribution.gaps_total_size).to eq(5119.MiB)
          end
        end

        context "and all the spaces are inside an extended partition" do
          let(:scenario) { "spaces_5_3_extended" }

          it "plans all partitions as logical" do
            types = distribution.spaces.map(&:partition_type)
            expect(types).to eq [:logical, :logical]
          end
        end

        context "and the spaces are unassigned (ms-dos partition table)" do
          context "and there is already an extended partition" do
            context "and the number of partitions exceeds the primary limit" do
              let(:scenario) { "spaces_5_3_used_extended_alt" }

              it "returns no distribution (nil)" do
                expect(distribution).to be_nil
              end
            end

            context "and there are not too many primary partitions already" do
              let(:scenario) { "spaces_5_3_used_extended" }

              it "sets the primary partition type for all the spaces" do
                types = distribution.spaces.map(&:partition_type)
                expect(types).to eq [:primary, :primary]
              end

              it "plans all partitions as primary" do
                logical = distribution.spaces.map(&:num_logical)
                expect(logical).to eq [0, 0]
              end
            end
          end

          context "and there is no extended partition" do
            let(:space5) { distribution.spaces.detect { |s| s.disk_size == 5.GiB } }
            let(:space3) { distribution.spaces.detect { |s| s.disk_size == (3.GiB - 1.MiB) } }

            context "and the number of partitions equals the primary limit" do
              it "does not set any enforced partition_type" do
                expect(space5.partition_type).to be_nil
                expect(space3.partition_type).to be_nil
              end

              it "plans all partitions in all spaces as primary" do
                expect(space5.num_logical).to eq 0
                expect(space3.num_logical).to eq 0
              end
            end

            context "and the number of partitions exceeds the primary limit" do
              let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 2.GiB) }
              let(:vol4) { planned_vol(mount_point: "/4", type: :ext4, min: 2.GiB - 2.MiB) }
              let(:volumes) { [vol1, vol2, vol3, vol4] }

              it "does not set any enforced partition_type" do
                expect(space5.partition_type).to be_nil
                expect(space3.partition_type).to be_nil
              end

              it "chooses one space to contain all the logical partitions" do
                expect(space5.num_logical).to eq 2
              end

              it "ensures other spaces only contain primary partitions" do
                expect(space3.num_logical).to eq 0
              end

              context "and there is no room for the EBRs" do
                let(:vol4) { planned_vol(mount_point: "/4", type: :ext4, min: 2.GiB) }

                it "returns no distribution (nil)" do
                  expect(distribution).to be_nil
                end
              end
            end

            context "and the number of partitions is below the primary limit" do
              let(:vol2) do
                planned_vol(mount_point: "/2", type: :ext4, min: 3.GiB - 1.MiB, max: 5.GiB)
              end
              let(:volumes) { [vol2, vol3] }

              it "does not set any enforced partition_type" do
                expect(space5.partition_type).to be_nil
                expect(space3.partition_type).to be_nil
              end

              it "plans all partitions in all spaces as primary" do
                expect(space5.num_logical).to eq 0
                expect(space3.num_logical).to eq 0
              end
            end
          end
        end
      end

      context "if there are free spaces that belong to a reused partition" do
        let(:scenario) { "several-dasds" }

        let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 1.GiB, max: 1.GiB, weight: 1) }
        let(:vol2) { planned_vol(mount_point: "/2", type: :ext4, min: 1.GiB, max: 1.GiB, weight: 1) }
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 1.GiB, max: 1.GiB, weight: 1) }
        let(:volumes) { [vol1, vol2, vol3] }

        it "only assigns one partition to the free space of a reused partition" do
          spaces_in_reused = distribution.spaces.select do |space|
            space.disk_space.reused_partition?
          end

          spaces_in_reused.each { |s| expect(s.partitions.size).to eq(1) }
        end
      end
    end

    context "when the only free space belongs to a reused partition" do
      let(:scenario) { "several-dasds" }

      let(:device) { fake_devicegraph.find_by_name(device_name) }

      let(:device_name) { "/dev/dasda" }

      let(:spaces) { device.free_spaces }

      context "and only one volume needs to be created" do
        let(:volumes) { [vol1] }

        it "allocates the volume in the available space" do
          expect(distribution.spaces.first.partitions).to contain_exactly(vol1)
        end
      end

      context "and several volumes needs to be created" do
        let(:volumes) { [vol1, vol2] }

        it "returns no distribution (nil)" do
          expect(distribution).to be_nil
        end
      end
    end

    context "if disk restrictions apply to some volume" do
      before do
        # Avoid rounding problems
        vol1.min_size = 1.GiB - 2.MiB
      end

      let(:vol3) do
        planned_vol(mount_point: "/3", type: :ext4, min: 3.GiB - 1.MiB, max: 3.GiB, disk: "/dev/sda")
      end

      context "if a proper distribution is possible" do
        let(:scenario) { "spaces_5_1_two_disks" }

        it "honors the disk restrictions" do
          sda = distribution.spaces.detect { |s| s.disk_name == "/dev/sda" }
          expect(sda.partitions).to include vol3
        end

        it "completely fills all the used spaces" do
          expect(distribution.gaps_count).to eq 0
        end
      end

      context "if the only way to avoid gaps is breaking the disk restrictions" do
        let(:scenario) { "spaces_3_8_two_disks" }

        it "honors the disk restrictions" do
          sda = distribution.spaces.detect { |s| s.disk_name == "/dev/sda" }
          expect(sda.partitions).to include vol3
        end

        it "creates the smallest possible gap" do
          expect(distribution.gaps_total_size).to eq(2.GiB - 1.MiB)
        end
      end

      context "if is not possible to honor the disk restrictions" do
        let(:scenario) { "spaces_2_10_two_disks" }

        it "returns no distribution (nil)" do
          expect(distribution).to be_nil
        end
      end
    end

    RSpec.shared_examples "configuration of PVs" do
      context "if encryption is being used" do
        let(:enc_password) { "DontLookAtMe" }

        it "sets #encrypted_password for all the PVs" do
          expect(pv_vols.map(&:encryption_password)).to all(eq "DontLookAtMe")
        end
      end

      context "if there are other volumes in the same space" do
        # Let's enforce the creation of more PVs to ensure there is one space
        # with one PV and one planned volume
        let(:lvm_size) { 18.GiB }
        let(:space) do
          distribution.spaces.detect do |space|
            space.partitions.size > 1 && space.partitions.any?(&:lvm_pv?)
          end
        end

        it "sets the weight of the PV according to the other volumes" do
          pv_vol = space.partitions.detect(&:lvm_pv?)
          total_weight = space.total_weight
          expect(pv_vol.weight).to eq(total_weight / 2.0)
        end
      end

      context "if the PV is alone in the disk space" do
        let(:space) do
          distribution.spaces.detect do |space|
            space.partitions.size == 1 && space.partitions.first.lvm_pv?
          end
        end

        it "sets the weight of the PV to one" do
          pv_vol = space.partitions.first
          expect(pv_vol.weight).to eq 1
        end
      end
    end

    context "when asking for extra LVM space with the :use_needed strategy" do
      let(:lvm_vg_strategy) { :use_needed }
      let(:scenario) { "spaces_5_6_8_10" }

      let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 1.GiB, max: 30.GiB, weight: 2) }
      let(:lvm_volumes) { [lvm_vol] }
      let(:lvm_vol) { planned_lv(min: lvm_size, max: lvm_max) }
      let(:lvm_max) { Y2Storage::DiskSize.unlimited }

      context "if the sum of all the spaces is not big enough" do
        let(:lvm_size) { 30.GiB }

        it "returns no distribution (nil)" do
          expect(distribution).to be_nil
        end
      end

      context "if all the needed LVM space can be hosted in a single place" do
        let(:lvm_size) { 9.GiB }

        it "adds one PV in that space" do
          expect(pv_vols.size).to eq 1
        end
      end

      context "if no single space is big enough" do
        let(:lvm_size) { 11.GiB }

        it "adds several PVs" do
          expect(pv_vols.size).to eq 2
        end
      end

      context "when creating PVs" do
        let(:lvm_size) { 11.GiB }
        let(:lvm_max) { 20.GiB }

        include_examples "configuration of PVs"

        it "sets min_size for all PVs to sum lvm_size" do
          useful_min_sizes = pv_vols.map { |v| planned_vg.useful_pv_space(v.min_size) }
          expect(useful_min_sizes.reduce(:+)).to eq lvm_size
        end

        it "sets max_size for all PVs to sum lvm_max" do
          useful_max_sizes = pv_vols.map { |v| planned_vg.useful_pv_space(v.max_size) }
          expect(useful_max_sizes.reduce(:+)).to eq lvm_max
        end

        context "if encryption is being used" do
          let(:enc_password) { "DontLookAtMe" }

          it "sets #encrypted_password for all the PVs" do
            expect(pv_vols.map(&:encryption_password)).to all(eq "DontLookAtMe")
          end
        end
      end

      context "when dealing with both LVM and logical partitions overhead" do
        let(:scenario) { "logical-lvm-rounding" }
        let(:lvm_size) { 5.GiB }
        let(:lvm_max) { 5.GiB }
        let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: 2.GiB, max: 2.GiB) }
        let(:vol2) { planned_vol(mount_point: "/2", type: :ext4, min: 1.GiB, max: 1.GiB) }
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 1.GiB, max: 1.GiB) }

        # This test was added because we figured out that the original algorithm
        # to create physical volume was leading to discard some valid solutions
        it "returns the best possible solution (minimal gap)" do
          expect(distribution.gaps_total_size).to be <= (4.GiB - 9.MiB)
          expect(distribution.gaps_count).to eq 1
        end
      end
    end

    context "when asking for extra LVM space with the :use_available strategy" do
      let(:lvm_vg_strategy) { :use_available }
      let(:scenario) { "spaces_5_6_8_10" }

      let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 1.GiB, max: 30.GiB, weight: 2) }
      let(:lvm_volumes) { [lvm_vol] }
      let(:lvm_vol) { planned_lv(min: lvm_size, max: lvm_max) }
      let(:lvm_max) { Y2Storage::DiskSize.unlimited }

      let(:assigned_spaces) { distribution.spaces.sort_by(&:disk_size) }

      context "if the sum of all the spaces is not big enough" do
        let(:lvm_size) { 30.GiB }

        it "returns no distribution (nil)" do
          expect(distribution).to be_nil
        end
      end

      context "if all the needed LVM space can be hosted in a single place" do
        let(:lvm_size) { 9.GiB }

        it "adds PVs in all the usable spaces" do
          with_pv = assigned_spaces.map { |sp| sp.partitions.any?(&:lvm_pv?) }
          expect(with_pv).to eq [false, true, true, true]
        end
      end

      context "if no single space is big enough" do
        let(:lvm_size) { 11.GiB }

        it "adds PVs in all the usable spaces" do
          with_pv = assigned_spaces.map { |sp| sp.partitions.any?(&:lvm_pv?) }
          expect(with_pv).to eq [false, true, true, true]
        end
      end

      context "when creating PVs" do
        let(:lvm_size) { 11.GiB }
        let(:lvm_max) { 20.GiB }

        include_examples "configuration of PVs"

        it "sets min_size for all PVs to be as big as needed" do
          useful_min_sizes = pv_vols.map { |v| planned_vg.useful_pv_space(v.min_size) }
          expect(useful_min_sizes.reduce(:+)).to be >= lvm_size
        end

        it "sets max_size for all PVs to be unlimited" do
          expect(pv_vols.map(&:max_size)).to all(be_unlimited)
        end
      end
    end

    context "when asking for extra LVM space with an unknown LVM strategy" do
      before do
        # A wrong strategy cannot even be assigned to settings. So to enforce
        # the unsupported situation we have to mock the value
        allow(settings).to receive(:lvm_vg_strategy).and_return :use_noodle
      end

      let(:scenario) { "spaces_5_6_8_10" }
      let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 1.GiB, max: 30.GiB, weight: 2) }
      let(:lvm_volumes) { [lvm_vol] }
      let(:lvm_vol) { planned_lv(min: 1.GiB, max: 2.GiB) }

      it "raises an exception" do
        expect { distribution }.to raise_error ArgumentError
      end
    end
  end

  describe "#resizing_size" do
    let(:volumes) { [vol1, vol2] }
    let(:vol1) { planned_vol(mount_point: "/1", type: :ext4, min: vol1_size) }
    let(:vol2) { planned_vol(mount_point: "/2", type: :ext4, min: vol2_size) }

    let(:spaces) { fake_devicegraph.free_spaces }
    let(:partition) { fake_devicegraph.find_by_name(partition_name) }
    let(:partition_name) { "/dev/sda5" }

    context "if the existing spaces can be used (not affected by primary partitions limit)" do
      let(:scenario) { "windows_resizing1" }

      context "but none of the planned partitions fit in the existing spaces" do
        let(:vol1_size) { 11.GiB }
        let(:vol2_size) { 12.GiB }

        it "returns the sum size of all the planned partitions" do
          # 2 extra MiB for the logical overhead (one MiB for each new logical
          # partition)
          result = calculator.resizing_size(partition, spaces)
          expect(result).to eq(vol1_size + vol2_size + 2.MiB)
        end
      end

      context "and some planned partitions fit in the existing spaces" do
        let(:vol1_size) { 9.GiB }
        let(:vol2_size) { 14.GiB }

        it "returns the sum size of the remaining planned partitions" do
          result = calculator.resizing_size(partition, spaces)
          # One extra MiB for the logical overhead
          expect(result).to eq(vol2_size + 1.MiB)
        end
      end
    end

    context "if the existing spaces cannot be used (primary partitions limit)" do
      let(:scenario) { "windows_resizing2" }

      context "and none of the planned partitions would have fitted in the existing spaces" do
        let(:vol1_size) { 11.GiB }
        let(:vol2_size) { 12.GiB }

        it "returns the sum size of all the planned partitions" do
          # 2 extra MiB for the logical overhead (one MiB for each new logical
          # partition)
          result = calculator.resizing_size(partition, spaces)
          expect(result).to eq(vol1_size + vol2_size + 2.MiB)
        end
      end

      context "and some planned partitions would have fitted in the existing spaces" do
        let(:vol1_size) { 9.GiB }
        let(:vol2_size) { 14.GiB }

        it "returns the sum size of all the planned partitions" do
          # 2 extra MiB for the logical overhead (one MiB for each new logical
          # partition)
          result = calculator.resizing_size(partition, spaces)
          expect(result).to eq(vol1_size + vol2_size + 2.MiB)
        end
      end
    end

    context "if there is a space right after the partition being resized" do
      let(:scenario) { "windows_resizing1" }
      let(:partition_name) { "/dev/sda1" }
      let(:vol1_size) { 11.GiB }
      let(:vol2_size) { 12.GiB }

      it "takes that extra space into account" do
        result = calculator.resizing_size(partition, spaces)
        space_size = spaces.first.disk_size
        expect(result).to eq(vol1_size + vol2_size - space_size)
      end
    end

    context "if there is an empty extended partition right after the partition being resized" do
      let(:scenario) { "windows_resizing2" }
      let(:extended) { fake_devicegraph.find_by_name("/dev/sda4") }

      before do
        extended.partition_table.delete_partition(extended.children.first)
      end

      let(:partition_name) { "/dev/sda3" }
      let(:volumes) { [vol1] }
      let(:vol1_size) { extended.size + 20.MiB }

      it "distinguishes the space inside the extended and the new space before it" do
        result = calculator.resizing_size(partition, spaces)
        # If the method would consider that the space at the beginning of the
        # extended /dev/sda4 would be affected by the resizing of /dev/sda3, the
        # result would be ~20 MiB. Fortunatelly, it's not the case and the method
        # returns the whole size of /dev/sda3 (meaning that resizing the partition
        # is not enough to make space for vol1).
        expect(result).to eq(partition.size)
      end
    end

    context "with misaligned partitions" do
      let(:scenario) { "empty_hard_disk_mbr_50GiB" }
      let(:ptable) { fake_devicegraph.find_by_name("/dev/sda").partition_table }
      let(:partition_name) { "/dev/sda1" }
      let(:block_size) { 512 }
      let(:vol1_size) { 11.GiB }
      let(:vol2_size) { 12.GiB }

      before do
        # One partition with misaligned start and end
        ptable.create_partition("/dev/sda1", Y2Storage::Region.create(640, 52427776, block_size),
          Y2Storage::PartitionType::PRIMARY)
        # One partition with misaligned start
        ptable.create_partition("/dev/sda2", Y2Storage::Region.create(52428416, 52429184, block_size),
          Y2Storage::PartitionType::PRIMARY)
      end

      def end_aligned?(end_block)
        mod = (block_size * (end_block + 1)) % ptable.align_grain.to_i
        mod.zero?
      end

      it "ensures the end of the resized partition will be aligned" do
        expect(end_aligned?(partition.end)).to eq false
        result = calculator.resizing_size(partition, spaces)
        new_end = partition.end - (result.to_i / block_size)
        expect(end_aligned?(new_end)).to eq true
      end

      it "reclaims enough space to ensure the new partitions can be aligned" do
        result = calculator.resizing_size(partition, fake_devicegraph.free_spaces)
        useless_space = partition.region.end_overhead(ptable.align_grain)
        expect(result).to eq(vol1_size + vol2_size + useless_space)
      end
    end

    context "when resizing does not seem to open new possibilities" do
      let(:scenario) { "windows_resizing1" }
      let(:partition_name) { "/dev/sda1" }
      let(:vol1_size) { 10.GiB }
      let(:vol2_size) { 10.GiB }

      context "due to limit of primary partitions" do
        let(:volumes) { [vol1, vol2, vol3] }
        let(:vol3) { planned_vol(mount_point: "/3", type: :ext4, min: 10.GiB) }

        # This behavior could be reconsidered to return something more
        # informative if the general algorithm is improved in the future
        it "returns the size of the full partition" do
          result = calculator.resizing_size(partition, spaces)
          expect(result).to eq(partition.size)
        end
      end

      context "due to the restrictions allocating partitions into disks" do
        let(:vol1) do
          planned_vol(disk: "/dev/nowhere", mount_point: "/1", type: :ext4, min: vol1_size)
        end

        # Same as above, this behavior could be reconsidered in the future
        it "does not take the unrelated partitions into account" do
          result = calculator.resizing_size(partition, spaces)
          expect(result).to eq(Y2Storage::DiskSize.zero)
        end
      end
    end

    # This test is here to ensure we cover the internal code that performs
    # stable sorting of the planned volumes
    context "when the planned partitions look equal to each other" do
      let(:scenario) { "windows_resizing2" }
      let(:partition_name) { "/dev/sda5" }
      let(:vol1_size) { 10.GiB }
      let(:vol2_size) { 10.GiB }

      it "returns the expected result" do
        result = calculator.resizing_size(partition, spaces)
        # 2 extra MiB for the logical overhead (one MiB for each new logical
        # partition)
        expect(result).to eq(vol1_size + vol2_size + 2.MiB)
      end
    end
  end
end
