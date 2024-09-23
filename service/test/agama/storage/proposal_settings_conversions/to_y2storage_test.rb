# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

require_relative "../../../test_helper"
require_relative "../storage_helpers"
require "agama/config"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_conversions/to_y2storage"
require "y2storage"

describe Agama::Storage::ProposalSettingsConversions::ToY2Storage do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(settings, config: config) }

  let(:config) { Agama::Config.new }

  describe "#convert" do
    let(:settings) do
      Agama::Storage::ProposalSettings.new.tap do |settings|
        settings.device.name = "/dev/sdc"
        settings.boot.device = "/dev/sda"
        settings.encryption.password = "notsecret"
        settings.encryption.method = Y2Storage::EncryptionMethod::LUKS2
        settings.encryption.pbkd_function = Y2Storage::PbkdFunction::ARGON2ID
        settings.space.policy = :custom
        settings.space.actions = { "/dev/sda" => :force_delete }
        volume = Agama::Storage::Volume.new("/test").tap do |vol|
          vol.location.target = :new_partition
          vol.location.device = "/dev/sdb"
        end
        settings.volumes = [volume]
      end
    end

    it "converts the settings to Y2Storage settings" do
      y2storage_settings = subject.convert

      expect(y2storage_settings).to be_a(Y2Storage::ProposalSettings)
      expect(y2storage_settings.root_device).to eq("/dev/sda")
      expect(y2storage_settings.candidate_devices).to eq(["/dev/sda"])
      expect(y2storage_settings.swap_reuse).to eq(:none)
      expect(y2storage_settings.lvm).to eq(false)
      expect(y2storage_settings.encryption_password).to eq("notsecret")
      expect(y2storage_settings.encryption_method).to eq(Y2Storage::EncryptionMethod::LUKS2)
      expect(y2storage_settings.encryption_pbkdf).to eq(Y2Storage::PbkdFunction::ARGON2ID)
      expect(y2storage_settings.space_settings.strategy).to eq(:bigger_resize)
      expect(y2storage_settings.space_settings.actions).to eq(
        [Y2Storage::SpaceActions::Delete.new("/dev/sda", mandatory: true)]
      )
      expect(y2storage_settings.volumes).to include(
        an_object_having_attributes(
          mount_point: "/test",
          device:      "/dev/sdb"
        )
      )
    end

    context "device conversion" do
      shared_examples "lvm conversion" do
        it "configures LVM settings" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.lvm).to eq(true)
          expect(y2storage_settings.separate_vgs).to eq(true)
          expect(y2storage_settings.lvm_vg_reuse).to eq(false)
          expect(y2storage_settings.lvm_vg_strategy).to eq(:use_needed)
        end
      end

      before do
        settings.volumes = [
          Agama::Storage::Volume.new("/test1"),
          Agama::Storage::Volume.new("/test2"),
          Agama::Storage::Volume.new("/test3").tap do |volume|
            volume.location.target = :new_partition
            volume.location.device = "/dev/sdb"
          end
        ]
      end

      context "when the device settings is set to use a disk" do
        before do
          settings.device = Agama::Storage::DeviceSettings::Disk.new("/dev/sda")
          settings.boot.device = "/dev/sdb"
        end

        it "sets lvm to false" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.lvm).to eq(false)
        end

        it "sets the target device as device for the volumes with missing device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.volumes).to contain_exactly(
            an_object_having_attributes(mount_point: "/test1", device: "/dev/sda"),
            an_object_having_attributes(mount_point: "/test2", device: "/dev/sda"),
            an_object_having_attributes(mount_point: "/test3", device: "/dev/sdb")
          )
        end

        it "sets the boot device as candidate device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.candidate_devices).to contain_exactly("/dev/sdb")
        end

        context "and no boot device is selected" do
          before do
            settings.boot.device = nil
          end

          it "sets the target device as candidate device" do
            y2storage_settings = subject.convert

            expect(y2storage_settings.candidate_devices).to contain_exactly("/dev/sda")
          end
        end

        context "and a volume is reusing a device" do
          before do
            settings.volumes = [
              Agama::Storage::Volume.new("/test1").tap do |volume|
                volume.location.target = :device
                volume.location.device = "/dev/sdb"
              end
            ]
          end

          it "does not set the target device as device for the volume with missing device" do
            y2storage_settings = subject.convert

            expect(y2storage_settings.volumes).to contain_exactly(
              an_object_having_attributes(mount_point: "/test1", device: nil)
            )
          end
        end
      end

      context "when the device settings is set to create a new LVM volume group" do
        before do
          settings.device = Agama::Storage::DeviceSettings::NewLvmVg.new(["/dev/sda", "/dev/sdb"])
        end

        include_examples "lvm conversion"

        it "sets the candidate PV devices as candidate devices" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.candidate_devices).to contain_exactly("/dev/sda", "/dev/sdb")
        end

        it "does not set the device for the volumes with missing device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.volumes).to contain_exactly(
            an_object_having_attributes(mount_point: "/test1", device: nil),
            an_object_having_attributes(mount_point: "/test2", device: nil),
            an_object_having_attributes(mount_point: "/test3", device: "/dev/sdb")
          )
        end
      end

      context "when the device settings is set to reuse a LVM volume group" do
        before do
          settings.device = Agama::Storage::DeviceSettings::ReusedLvmVg.new("/dev/vg0")
        end

        include_examples "lvm conversion"

        xit "sets the reused LVM volume group as target device" do
          # TODO: Feature not supported yet by yast2-storage-ng.
        end

        it "does not set the device for the volumes with missing device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.volumes).to contain_exactly(
            an_object_having_attributes(mount_point: "/test1", device: nil),
            an_object_having_attributes(mount_point: "/test2", device: nil),
            an_object_having_attributes(mount_point: "/test3", device: "/dev/sdb")
          )
        end
      end
    end

    context "boot conversion" do
      context "if boot configuration is enabled" do
        before do
          settings.boot.configure = true
        end

        it "sets boot to true" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.boot).to eq(true)
        end
      end

      context "if boot configuration is disabled" do
        before do
          settings.boot.configure = false
        end

        it "sets boot to false" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.boot).to eq(false)
        end
      end

      context "if a boot device is selected" do
        before do
          settings.boot.device = "/dev/sda"
        end

        it "sets the boot device as root device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.root_device).to eq("/dev/sda")
        end
      end

      context "if no boot device is selected" do
        before do
          settings.boot.device = nil
        end

        context "and the device settings is set to use a disk" do
          before do
            settings.device = Agama::Storage::DeviceSettings::Disk.new("/dev/sda")
          end

          it "sets the target device as root device" do
            y2storage_settings = subject.convert

            expect(y2storage_settings.root_device).to eq("/dev/sda")
          end
        end

        context "and the device settings is set to create a new LVM volume group" do
          before do
            settings.device = Agama::Storage::DeviceSettings::NewLvmVg.new(["/dev/sda", "/dev/sdb"])
          end

          it "sets the first candidate device as root device" do
            y2storage_settings = subject.convert

            expect(y2storage_settings.root_device).to eq("/dev/sda")
          end
        end
      end
    end

    context "space policy conversion" do
      before do
        mock_storage(devicegraph: "staging-plain-partitions.yaml")
      end

      context "when the space policy is set to :delete" do
        before do
          settings.space.policy = :delete
        end

        it "generates delete actions for all the partitions at the used devices" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.space_settings).to have_attributes(
            strategy: :bigger_resize,
            actions:  [
              Y2Storage::SpaceActions::Delete.new("/dev/sda1", mandatory: true),
              Y2Storage::SpaceActions::Delete.new("/dev/sda2", mandatory: true),
              Y2Storage::SpaceActions::Delete.new("/dev/sda3", mandatory: true)
            ]
          )
        end
      end

      context "when the space policy is set to :resize" do
        before do
          settings.space.policy = :resize

          allow(Agama::Storage::DeviceShrinking).to receive(:new) do |dev|
            dev.name == "/dev/sda2" ? shrink_true : shrink_false
          end
        end

        let(:shrink_false) { instance_double(Agama::Storage::DeviceShrinking, supported?: false) }
        let(:shrink_true) { instance_double(Agama::Storage::DeviceShrinking, supported?: true) }

        it "generates resize actions for the partitions that support shrinking" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.space_settings).to have_attributes(
            strategy: :bigger_resize,
            actions:  [Y2Storage::SpaceActions::Resize.new("/dev/sda2")]
          )
        end
      end

      context "when the space policy is set to :keep" do
        before do
          settings.space.policy = :keep
        end

        it "generates no actions" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.space_settings).to have_attributes(
            strategy: :bigger_resize,
            actions:  {}
          )
        end
      end
    end

    context "volumes conversion" do
      let(:config) do
        Agama::Config.new(
          {
            "storage" => {
              "volume_templates" => [
                {
                  "mount_path" => "/",
                  "outline"    => { "required" => true }
                },
                {
                  "mount_path" => "/home",
                  "outline"    => { "required" => false }
                },
                {
                  "mount_path" => "swap",
                  "outline"    => { "required" => false }
                },
                {
                  "outline" => { "required" => false }
                }
              ]
            }
          }
        )
      end

      it "includes missing config templates as not proposed volumes" do
        y2storage_settings = subject.convert

        expect(y2storage_settings.volumes).to contain_exactly(
          an_object_having_attributes(mount_point: "/", proposed: false),
          an_object_having_attributes(mount_point: "/home", proposed: false),
          an_object_having_attributes(mount_point: "swap", proposed: false),
          an_object_having_attributes(mount_point: "/test", proposed: true)
        )
      end

      it "sets the fallback for min and max sizes" do
        volume = Agama::Storage::Volume.new("/test").tap do |vol|
          vol.outline.min_size_fallback_for = ["/home", "swap"]
          vol.outline.max_size_fallback_for = ["swap"]
        end

        settings.volumes = [volume]

        y2storage_settings = subject.convert

        expect(y2storage_settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point:               "/",
            fallback_for_min_size:     nil,
            fallback_for_max_size:     nil,
            fallback_for_max_size_lvm: nil
          ),
          an_object_having_attributes(
            mount_point:               "/home",
            fallback_for_min_size:     "/test",
            fallback_for_max_size:     nil,
            fallback_for_max_size_lvm: nil
          ),
          an_object_having_attributes(
            mount_point:               "swap",
            fallback_for_min_size:     "/test",
            fallback_for_max_size:     "/test",
            fallback_for_max_size_lvm: "/test"
          ),
          an_object_having_attributes(
            mount_point:               "/test",
            fallback_for_min_size:     nil,
            fallback_for_max_size:     nil,
            fallback_for_max_size_lvm: nil
          )
        )
      end
    end
  end
end
