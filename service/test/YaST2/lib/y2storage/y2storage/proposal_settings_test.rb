#!/usr/bin/env rspec
# frozen_string_literal: true

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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage"

Yast.import "ProductFeatures"

describe Y2Storage::ProposalSettings do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  def stub_features(all_features)
    Yast::ProductFeatures.Import(all_features)
  end

  def stub_partitioning_features(features = {})
    stub_features("partitioning" => initial_partitioning_features.merge(features))
  end

  # Used to test the mechanism to inject an encryption password into the settings
  class TestInjectedPassword
    include Y2Storage::SecretAttributes

    # Real password
    secret_attr :password

    # Constructor
    def initialize(passwd)
      self.password = passwd
    end
  end

  before do
    Y2Storage::StorageManager.create_test_instance
  end

  let(:initial_partitioning_features) { {} }

  describe "#deep_copy" do
    subject(:settings) { described_class.new_for_current_product }

    let(:volumes) do
      [
        {
          "mount_point" => "/", "fs_type" => "xfs", "weight" => 60,
          "desired_size" => "20GiB", "max_size" => "40GiB"
        },
        { "mount_point" => "/home", "fs_type" => "xfs", "weight" => 40, "desired_size" => "10GiB" },
        { "mount_point" => "swap", "fs_type" => "swap", "desired_size" => "3GiB" }
      ]
    end

    let(:partitioning) do
      { "proposal" => {}, "volumes" => volumes }
    end

    before do
      stub_partitioning_features(partitioning)
    end

    it "creates a new object" do
      expect(settings.deep_copy).to_not equal(settings)
    end

    it "creates an object with the same values" do
      expect(settings.deep_copy).to eq(settings)
    end

    it "creates an object with different references" do
      ids = settings.volumes.map(&:object_id).sort
      new_ids = settings.deep_copy.volumes.map(&:object_id).sort

      expect(new_ids).to_not eq(ids)
    end
  end

  describe "#volumes_sets" do
    subject(:settings) { described_class.new_for_current_product }

    let(:home_vg_name) { nil }
    let(:lib_vg_name) { nil }
    let(:usr_vg_name) { nil }
    let(:var_vg_name) { nil }

    let(:volumes) do
      [
        { "mount_point" => "/home", "separate_vg_name" => home_vg_name },
        { "mount_point" => "/lib", "separate_vg_name" => lib_vg_name },
        { "mount_point" => "/usr", "separate_vg_name" => usr_vg_name },
        { "mount_point" => "/var", "separate_vg_name" => var_vg_name }
      ]
    end

    let(:partitioning) do
      { "proposal" => {}, "volumes" => volumes }
    end

    before do
      stub_partitioning_features(partitioning)

      allow(settings).to receive(:separate_vgs).and_return(separate_vgs)
      allow(settings).to receive(:lvm).and_return(lvm)
    end

    context "when 'separate_vgs' is set to false" do
      let(:separate_vgs) { false }

      context "and 'lvm' is set" do
        let(:lvm) { true }

        it "contains only a single :lvm volumes set" do
          volumes_sets = settings.volumes_sets

          expect(volumes_sets.count).to eq(1)
          expect(volumes_sets.first.type).to eq(:lvm)
        end
      end

      context "but 'lvm' is not set" do
        let(:lvm) { false }

        it "contains a :partition volumes set per available volume" do
          volumes_sets = settings.volumes_sets

          expect(volumes_sets.count).to eq(settings.volumes.count)
          expect(volumes_sets.map(&:type).uniq).to eq([:partition])
        end
      end
    end

    context "when 'separate_vgs' is set to true" do
      let(:separate_vgs) { true }

      shared_examples "has only :separate_lvm volumes sets" do
        let(:home_vg_name) { "vg-home" }
        let(:lib_vg_name) { "vg-lib" }
        let(:usr_vg_name) { "vg-usr" }
        let(:var_vg_name) { "vg-var" }

        it "does not contain :lvm volumes sets" do
          expect(settings.volumes_sets.map(&:type).uniq).to_not include(:lvm)
        end

        it "does not contain :partition volumes sets" do
          expect(settings.volumes_sets.map(&:type).uniq).to_not include(:partition)
        end

        it "contains a :separate_lvm volumes set per vg name" do
          expect(settings.volumes_sets.map(&:type).uniq).to eq([:separate_lvm])
        end

        context "being all of them different" do
          it "contains a volume set per vg name" do
            expect(settings.volumes_sets.count).to eq(4)
          end
        end

        context "being some of them shared" do
          let(:home_vg_name) { "vg-home" }
          let(:lib_vg_name) { "vg-shared" }
          let(:usr_vg_name) { "vg-shared" }
          let(:var_vg_name) { "vg-shared" }

          it "contains a volume set per vg name" do
            expect(settings.volumes_sets.count).to eq(2)
          end
        end
      end

      context "and 'lvm' is set" do
        let(:lvm) { true }

        context "and no volumes have a separate vg name" do
          it "contains only a single :lvm volumes set" do
            volumes_sets = settings.volumes_sets

            expect(volumes_sets.count).to eq(1)
            expect(volumes_sets.first.type).to eq(:lvm)
          end
        end

        context "but some volumes have a separate vg name" do
          let(:home_vg_name) { "vg-home" }
          let(:var_vg_name) { "vg-var" }

          it "contains one :lvm volumes set" do
            lvm_volumes_sets = settings.volumes_sets.select { |vs| vs.type == :lvm }

            expect(lvm_volumes_sets.count).to eq(1)
          end

          it "contains a :separate_lvm volumes set per vg name" do
            separate_volumes_sets = settings.volumes_sets.select { |vs| vs.type == :separate_lvm }

            expect(separate_volumes_sets.count).to eq(2)
          end
        end

        context "but all volumes have a separate vg name" do
          include_examples "has only :separate_lvm volumes sets"
        end
      end

      context "but 'lvm' is not set" do
        let(:lvm) { false }

        context "and no volumes have a separate vg name" do
          it "contains only :partition volumes sets" do
            expect(settings.volumes_sets.map(&:type).uniq).to eq([:partition])
          end
        end

        context "but some volumes have a separate vg name" do
          let(:home_vg_name) { "vg-home" }
          let(:var_vg_name) { "vg-var" }

          it "does not contains a :lvm volumes set" do
            expect(settings.volumes_sets.map(&:type).uniq).to_not include(:lvm)
          end

          it "contains a :partition volumes set per not separated volume" do
            partition_volumes_sets = settings.volumes_sets.select { |vs| vs.type == :partition }

            expect(partition_volumes_sets.count).to eq(2)
          end

          it "contains a volumes set per vg name" do
            separate_volumes_sets = settings.volumes_sets.select { |vs| vs.type == :separate_lvm }

            expect(separate_volumes_sets.count).to eq(2)
          end
        end

        context "but all volumes have separate vg name" do
          include_examples "has only :separate_lvm volumes sets"
        end
      end
    end
  end

  describe "#for_current_product" do
    subject(:settings) { described_class.new }

    let(:initial_partitioning_features) do
      { "proposal" => proposal_features, "volumes" => volumes_features }
    end

    let(:proposal_features) { {} }

    let(:volumes_features) { [] }

    def read_feature(feature, value)
      stub_partitioning_features("proposal" => { feature => value })
      settings.for_current_product
    end

    context "when the 'partitioning' section is missing from the product features" do
      before do
        stub_features("another_section" => { "value" => true })

        settings.use_lvm = true
        settings.linux_delete_mode = :all
      end

      it "does not modify initalized settings" do
        settings.for_current_product

        expect(settings.use_lvm).to eq true
        expect(settings.linux_delete_mode).to eq :all
      end

      it "sets not initalized settings with default values" do
        settings.for_current_product

        expect(settings.resize_windows).to eq true
        expect(settings.lvm_vg_strategy).to eq :use_available
        expect(settings.volumes).to eq []
      end
    end

    context "when some features have a value and others don't" do
      let(:proposal_features) do
        {
          "separate_vgs"        => false,
          "resize_windows"      => true,
          "windows_delete_mode" => :none
        }
      end

      let(:volumes_features) { [{ "mount_point" => "/", "min_size" => "3.33 GiB" }] }

      before do
        settings.separate_vgs = true
        settings.use_lvm = true
        settings.resize_windows = false
        settings.windows_delete_mode = :all
        settings.linux_delete_mode = :all

        stub_partitioning_features(initial_partitioning_features)
      end

      it "overrides previous values with the corresponding present features" do
        expect(settings.separate_vgs).to eq true
        expect(settings.resize_windows).to eq false
        expect(settings.windows_delete_mode).to eq :all
        expect(settings.volumes).to be_nil

        settings.for_current_product

        expect(settings.separate_vgs).to eq false
        expect(settings.resize_windows).to eq true
        expect(settings.windows_delete_mode).to eq :none
        expect(settings.volumes.first.mount_point).to eq "/"
      end

      it "does not modify values corresponding to omitted features" do
        settings.for_current_product

        expect(settings.use_lvm).to eq true
        expect(settings.linux_delete_mode).to eq :all
      end
    end

    it "sets 'lvm' based on the feature in the 'proposal' section" do
      read_feature("lvm", true)
      expect(settings.lvm).to eq true
      read_feature("lvm", false)
      expect(settings.lvm).to eq false
    end

    it "sets 'encryption_password' based on the 'encryption' feature in the 'proposal' section" do
      read_feature("encryption", "SuperSecret")
      expect(settings.use_encryption).to eq false
      expect(settings.encryption_password).to eq nil
      read_feature("encryption", TestInjectedPassword.new("SuperSecret"))
      expect(settings.use_encryption).to eq true
      expect(settings.encryption_password).to eq "SuperSecret"
    end

    it "sets 'delete_resize_configurable' based on the feature in the 'proposal' section" do
      read_feature("delete_resize_configurable", true)
      expect(settings.delete_resize_configurable).to eq true
      read_feature("delete_resize_configurable", false)
      expect(settings.delete_resize_configurable).to eq false
    end

    it "sets 'resize_windows' based on the feature in the 'proposal' section" do
      read_feature("resize_windows", true)
      expect(settings.resize_windows).to eq true
      read_feature("resize_windows", false)
      expect(settings.resize_windows).to eq false
    end

    it "sets 'windows_delete_mode' based on the feature in the 'proposal' section" do
      read_feature("windows_delete_mode", :none)
      expect(settings.windows_delete_mode).to eq :none
      read_feature("windows_delete_mode", :ondemand)
      expect(settings.windows_delete_mode).to eq :ondemand
    end

    it "sets 'linux_delete_mode' based on the feature in the 'proposal' section" do
      read_feature("linux_delete_mode", :none)
      expect(settings.linux_delete_mode).to eq :none
      read_feature("linux_delete_mode", :ondemand)
      expect(settings.linux_delete_mode).to eq :ondemand
    end

    it "sets 'other_delete_mode' based on the feature in the 'proposal' section" do
      read_feature("other_delete_mode", :none)
      expect(settings.other_delete_mode).to eq :none
      read_feature("other_delete_mode", :ondemand)
      expect(settings.other_delete_mode).to eq :ondemand
    end

    it "sets 'lvm_vg_strategy' based on the feature in the 'proposal' section" do
      read_feature("lvm_vg_strategy", :use_available)
      expect(settings.lvm_vg_strategy).to eq :use_available
      read_feature("lvm_vg_strategy", :use_needed)
      expect(settings.lvm_vg_strategy).to eq :use_needed
    end

    it "sets 'lvm_vg_size' based on the feature in the 'proposal' section" do
      read_feature("lvm_vg_size", "1 GiB")
      expect(settings.lvm_vg_size).to eq 1.GiB
      read_feature("lvm_vg_size", "5 MiB")
      expect(settings.lvm_vg_size).to eq 5.MiB
    end

    context "when reading the 'volumes' section" do
      before do
        stub_features(
          "globals"      => { "preferred_bootloader" => bootloader },
          "partitioning" => initial_partitioning_features
        )
      end

      let(:bootloader) { nil }

      context "and the list of volumes is empty" do
        let(:volumes_features) { [] }

        it "returns an empty list of volumes" do
          settings.for_current_product
          expect(settings.volumes).to be_empty
        end
      end

      context "and the list of volumes is not empty" do
        let(:volumes_features) do
          [{ "mount_point" => "/" }, { "mount_point" => "/home", "min_size" => "5 GiB" }]
        end

        before do
          allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(true)
          allow(Yast::Arch).to receive(:x86_64).and_return(true)
          allow(Yast::Arch).to receive(:aarch64).and_return(true)
        end

        it "creates a VolumeSpecification for each volume in the list" do
          settings.for_current_product
          expect(settings.volumes.map(&:class)).to eq([Y2Storage::VolumeSpecification] * 2)
        end

        context "and the default bootloader is Grub2" do
          let(:bootloader) { nil }

          it "the root volume specification contains grub2 specific subvolumes" do
            settings.for_current_product
            subvolumes = settings.volumes.flat_map(&:subvolumes)
            ret = subvolumes.any? { |s| s.path.include?("boot/grub2") }
            expect(ret).to eq(true)
          end
        end

        context "and the default bootloader is a BLS one" do
          let(:bootloader) { "systemd-boot" }

          it "the root volume does not contain grub2 specific subvolumes" do
            settings.for_current_product
            subvolumes = settings.volumes.flat_map(&:subvolumes)
            ret = subvolumes.any? { |s| s.path.include?("boot/grub2") }
            expect(ret).to eq(false)
          end
        end
      end
    end

    context "setting the 'bootloader' property" do
      before do
        allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(efi)
        allow(Yast::Arch).to receive(:x86_64).and_return(x86)
        allow(Yast::Arch).to receive(:aarch64).and_return(aarch)

        stub_features("globals" => { "preferred_bootloader" => preferred })
      end

      RSpec.shared_examples "bls_legacy if configured" do
        context "with preferred_bootloader configured as 'systemd-boot'" do
          let(:preferred) { "systemd-boot" }

          it "sets 'bootloader' to SYSTEMD_BOOT" do
            settings.for_current_product
            expect(settings.bootloader).to eq Y2Storage::BootloaderType::BLS_LEGACY
          end
        end

        context "with preferred_bootloader configured as 'grub2-bls'" do
          let(:preferred) { "grub2-bls" }

          it "sets 'bootloader' to GRUB2_BLS" do
            settings.for_current_product
            expect(settings.bootloader).to eq Y2Storage::BootloaderType::BLS_LEGACY
          end
        end

        context "with not defined preferred_bootloader" do
          let(:preferred) { nil }

          it "sets 'bootloader' to GRUB2" do
            settings.for_current_product
            expect(settings.bootloader).to eq Y2Storage::BootloaderType::GRUB2
          end
        end
      end

      RSpec.shared_examples "grub2 in any case" do
        context "with preferred_bootloader configured as 'systemd-boot'" do
          let(:preferred) { "systemd-boot" }

          it "sets 'bootloader' to GRUB2" do
            settings.for_current_product
            expect(settings.bootloader).to eq Y2Storage::BootloaderType::GRUB2
          end
        end

        context "with preferred_bootloader configured as 'grub2-bls'" do
          let(:preferred) { "grub2-bls" }

          it "sets 'bootloader' to GRUB2" do
            settings.for_current_product
            expect(settings.bootloader).to eq Y2Storage::BootloaderType::GRUB2
          end
        end

        context "with not defined preferred_bootloader" do
          let(:preferred) { nil }

          it "sets 'bootloader' to GRUB2" do
            settings.for_current_product
            expect(settings.bootloader).to eq Y2Storage::BootloaderType::GRUB2
          end
        end
      end

      context "when booting in EFI mode" do
        let(:efi) { true }

        context "in a x86 system" do
          let(:x86) { true }
          let(:aarch) { false }

          include_examples "bls_legacy if configured"
        end

        context "in a aarch64 system" do
          let(:x86) { false }
          let(:aarch) { true }

          include_examples "bls_legacy if configured"
        end

        context "in any other architecture" do
          let(:x86) { false }
          let(:aarch) { false }

          include_examples "grub2 in any case"
        end
      end

      context "when not booting in EFI mode" do
        let(:efi) { false }

        context "in a x86 system" do
          let(:x86) { true }
          let(:aarch) { false }

          include_examples "grub2 in any case"
        end

        context "in a aarch64 system" do
          let(:x86) { false }
          let(:aarch) { true }

          include_examples "grub2 in any case"
        end

        context "in any other architecture" do
          let(:x86) { false }
          let(:aarch) { false }

          include_examples "grub2 in any case"
        end
      end
    end

    context "when reading a size" do
      before do
        stub_partitioning_features("volumes" => [{ "mount_point" => "/", "min_size" => size }])
      end

      context "written as a string with spaces" do
        let(:size) { "121 MiB" }

        it "parses it correctly" do
          settings.for_current_product
          expect(settings.volumes.first.min_size).to eq 121.MiB
        end
      end

      context "written as a string without spaces" do
        let(:size) { "121MiB" }

        it "parses it correctly" do
          settings.for_current_product
          expect(settings.volumes.first.min_size).to eq 121.MiB
        end
      end

      context "written with units of base 10" do
        let(:size) { "121MB" }

        it "parses the string assuming the units are always power of two" do
          settings.for_current_product

          expect(settings.volumes.first.min_size).to_not eq 121.MB
          expect(settings.volumes.first.min_size).to eq 121.MiB
        end
      end

      context "written as a non-parseable string" do
        let(:size) { "twelve" }

        it "ignores the value" do
          settings.for_current_product

          expect(settings.volumes.first.min_size).to be_zero
        end
      end
    end

    context "when reading an integer" do
      before do
        stub_partitioning_features(
          "volumes" => [{ "mount_point" => "/", "weight" => weight, "disable_order" => order }]
        )
      end

      context "with a value bigger than zero" do
        let(:weight) { "10000" }
        let(:order) { 1 }

        it "stores the value" do
          settings.for_current_product

          expect(settings.volumes.first.disable_order).to eq 1
          expect(settings.volumes.first.weight).to eq 10000
        end
      end

      context "with a value of zero" do
        let(:weight) { "0" }
        let(:order) { 0 }

        it "stores the value" do
          settings.for_current_product

          expect(settings.volumes.first.disable_order).to eq 0
          expect(settings.volumes.first.weight).to eq 0
        end
      end

      context "with a negative value" do
        let(:weight) { -5 }
        let(:order) { "-12" }

        it "ignores the value" do
          settings.for_current_product

          expect(settings.volumes.first.disable_order).to be_nil
          expect(settings.volumes.first.weight).to be_zero
        end
      end
    end

    context "when reading a boolean" do
      let(:proposal_features) { {} }

      it "does not consider missing features to be false" do
        settings.use_lvm = true
        stub_partitioning_features(initial_partitioning_features)

        settings.for_current_product
        expect(settings.use_lvm).to eq true
      end
    end
  end

  describe ".new_for_current_product" do
    subject(:from_product) { described_class.new_for_current_product }

    before do
      stub_partitioning_features(
        "proposal" => {
          "lvm"                 => true,
          "resize_windows"      => false,
          "windows_delete_mode" => :none
        }
      )
    end

    it "returns a new ProposalSettings object" do
      expect(from_product).to be_a described_class
    end

    it "returns an object that uses default values for the omitted features" do
      expect(from_product.multidisk_first).to eq false
      expect(from_product.linux_delete_mode).to eq :ondemand
      expect(from_product.volumes).to eq []
    end

    it "returns an object that uses the read values for the present features" do
      expect(from_product.use_lvm).to eq true
      expect(from_product.resize_windows).to eq false
      expect(from_product.windows_delete_mode).to eq :none
    end
  end

  describe "#snapshots_active?" do
    let(:initial_partitioning_features) { { "proposal" => [], "volumes" => volumes_features } }

    let(:settings) { described_class.new_for_current_product }

    before do
      stub_partitioning_features
    end

    context "and there is not a root volume" do
      let(:volumes_features) { [{ "mount_point" => "/home", "snapshots" => true }] }

      it "returns false" do
        expect(settings.snapshots_active?).to eq(false)
      end
    end

    context "and there is a root volume" do
      let(:volumes_features) { [{ "mount_point" => "/", "snapshots" => snapshots }] }

      context "and snapshots feature is not active" do
        let(:snapshots) { false }

        it "returns false" do
          expect(settings.snapshots_active?).to eq(false)
        end
      end

      context "and snapshots feature is active" do
        let(:snapshots) { true }

        it "returns true" do
          expect(settings.snapshots_active?).to eq(true)
        end
      end
    end
  end

  describe "#allocate_mode?" do
    subject(:settings) { described_class.new_for_current_product }

    before do
      settings.allocate_volume_mode = :device
    end

    context "when given mode is the current allocate volume mode" do
      it "returns true" do
        expect(settings.allocate_mode?(:device)).to eq(true)
      end
    end

    context "when given mode is not the current allocate volume mode" do
      it "returns false" do
        expect(settings.allocate_mode?(:auto)).to eq(false)
      end
    end
  end

  describe "#separate_vgs_relevant?" do
    subject(:settings) { described_class.new_for_current_product }

    before do
      stub_partitioning_features
    end

    context "when the format is :ng" do
      let(:initial_partitioning_features) { { "proposal" => [], "volumes" => volumes } }
      let(:vg_name) { nil }
      let(:volumes) do
        [
          { "mount_point" => "/" },
          { "mount_point" => "swap" },
          { "mount_point" => "/home", "separate_vg_name" => vg_name }
        ]
      end

      context "and there are no volumes with a separate vg name" do
        it "returns false" do
          expect(settings.separate_vgs_relevant?).to eq(false)
        end
      end

      context "and there is some volume with a separate vg name" do
        let(:vg_name) { "vg-name" }

        it "returns true" do
          expect(settings.separate_vgs_relevant?).to eq(true)
        end
      end
    end
  end

  describe "#force_enable_snapshots" do
    subject(:settings) { described_class.new_for_current_product }

    let(:initial_partitioning_features) { { "proposal" => [], "volumes" => volumes } }

    context "when there is no root volume" do
      let(:volumes) { [] }

      it "does not fail" do
        expect { subject.force_enable_snapshots }.to_not raise_error
      end
    end

    context "when there is a root volume" do
      let(:volumes) { [{ "mount_point" => "/" }] }

      it "enables snapshots for the root volume" do
        subject.force_enable_snapshots

        root = subject.volumes.find(&:root?)

        expect(root.snapshots?).to eq(true)
      end

      it "set snapshots as not configurable for the root volume" do
        subject.force_enable_snapshots

        root = subject.volumes.find(&:root?)

        expect(root.snapshots_configurable?).to eq(false)
      end
    end
  end

  describe "#force_disable_snapshots" do
    subject(:settings) { described_class.new_for_current_product }

    let(:initial_partitioning_features) { { "proposal" => [], "volumes" => volumes } }

    context "when there is no root volume" do
      let(:volumes) { [] }

      it "does not fail" do
        expect { subject.force_disable_snapshots }.to_not raise_error
      end
    end

    context "when there is a root volume" do
      let(:volumes) { [{ "mount_point" => "/" }] }

      it "disables snapshots for the root volume" do
        subject.force_disable_snapshots

        root = subject.volumes.find(&:root?)

        expect(root.snapshots?).to eq(false)
      end

      it "set snapshots as not configurable for the root volume" do
        subject.force_disable_snapshots

        root = subject.volumes.find(&:root?)

        expect(root.snapshots_configurable?).to eq(false)
      end
    end
  end

  describe "#to_s" do
    subject(:settings) { described_class.new_for_current_product }

    before do
      stub_partitioning_features
    end

    context "when the format is :ng" do
      let(:initial_partitioning_features) { { "proposal" => [], "volumes" => {} } }

      it "generates a string representation for ng format" do
        expect(settings.to_s).to match("(ng)")
      end
    end
  end
end
