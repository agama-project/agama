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
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_conversion/to_y2storage"
require "y2storage"

describe Agama::Storage::ProposalSettingsConversion::ToY2Storage do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(settings, config: config) }

  let(:config) { Agama::Config.new }

  describe "#convert" do
    let(:settings) do
      Agama::Storage::ProposalSettings.new.tap do |settings|
        settings.target_device = "/dev/sdc"
        settings.boot_device = "/dev/sda"
        settings.lvm.enabled = false
        settings.lvm.system_vg_devices = ["/dev/sda", "/dev/sdb"]
        settings.encryption.password = "notsecret"
        settings.encryption.method = Y2Storage::EncryptionMethod::LUKS2
        settings.encryption.pbkd_function = Y2Storage::PbkdFunction::ARGON2ID
        settings.space.policy = :custom
        settings.space.actions = { "/dev/sda" => :force_delete }
        volume = Agama::Storage::Volume.new("/test").tap { |v| v.device = "/dev/sdb" }
        settings.volumes = [volume]
      end
    end

    it "converts the settings to Y2Storage settings" do
      y2storage_settings = subject.convert

      expect(y2storage_settings).to be_a(Y2Storage::ProposalSettings)
      expect(y2storage_settings).to have_attributes(
        root_device:         "/dev/sda",
        candidate_devices:   ["/dev/sda"],
        swap_reuse:          :none,
        lvm:                 false,
        separate_vgs:        false,
        lvm_vg_reuse:        false,
        lvm_vg_strategy:     :use_needed,
        encryption_password: "notsecret",
        encryption_method:   Y2Storage::EncryptionMethod::LUKS2,
        encryption_pbkdf:    Y2Storage::PbkdFunction::ARGON2ID,
        space_settings:      an_object_having_attributes(
          strategy: :bigger_resize,
          actions:  { "/dev/sda" => :force_delete }
        ),
        volumes:             include(
          an_object_having_attributes(
            mount_point: "/test",
            device:      "/dev/sdb"
          )
        )
      )
    end

    context "when LVM is not used" do
      before do
        settings.lvm.enabled = false
      end

      it "does not enable LVM" do
        y2storage_settings = subject.convert

        expect(y2storage_settings).to have_attributes(
          lvm:          false,
          separate_vgs: false
        )
      end

      context "and a specific boot device is set" do
        before do
          settings.boot_device = "/dev/sda"
          settings.target_device = "/dev/sdb"
        end

        it "sets the boot device as root device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            root_device: "/dev/sda"
          )
        end

        it "sets the boot device as candidate device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            candidate_devices: contain_exactly("/dev/sda")
          )
        end
      end

      context "and no specific boot device is set" do
        before do
          settings.boot_device = nil
          settings.target_device = "/dev/sdb"
        end

        it "sets the target device as root device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            root_device: "/dev/sdb"
          )
        end

        it "sets the target device as candidate device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            candidate_devices: contain_exactly("/dev/sdb")
          )
        end
      end

      context "and a volume indicates a device" do
        before do
          volume = settings.volumes.find { |v| v.mount_path == "/test" }
          volume.device = "/dev/sda"
          settings.target_device = "/dev/sdb"
        end

        it "keeps the device of the volume" do
          y2storage_settings = subject.convert
          y2storage_volume = y2storage_settings.volumes.find { |v| v.mount_point == "/test" }

          expect(y2storage_volume).to have_attributes(
            device: "/dev/sda"
          )
        end
      end

      context "and a volume does not indicate a device" do
        before do
          volume = settings.volumes.find { |v| v.mount_path == "/test" }
          volume.device = nil
          settings.target_device = "/dev/sdb"
        end

        it "sets the target device as the device of the volume" do
          y2storage_settings = subject.convert
          y2storage_volume = y2storage_settings.volumes.find { |v| v.mount_point == "/test" }

          expect(y2storage_volume).to have_attributes(
            device: "/dev/sdb"
          )
        end
      end
    end

    context "when LVM is used" do
      before do
        settings.lvm.enabled = true
      end

      it "enables LVM" do
        y2storage_settings = subject.convert

        expect(y2storage_settings).to have_attributes(
          lvm:          true,
          separate_vgs: true
        )
      end

      context "and a specific boot device is set" do
        before do
          settings.boot_device = "/dev/sda"
          settings.target_device = "/dev/sdb"
          settings.lvm.system_vg_devices = ["/dev/sdc"]
        end

        it "sets the boot device as root device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            root_device: "/dev/sda"
          )
        end
      end

      context "and no specific boot device is set" do
        before do
          settings.boot_device = nil
          settings.target_device = "/dev/sdb"
          settings.lvm.system_vg_devices = ["/dev/sdc"]
        end

        it "does not set a root device" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            root_device: be_nil
          )
        end
      end

      context "and system VG devices are indicated" do
        before do
          settings.target_device = "/dev/sda"
          settings.boot_device = "/dev/sdd"
          settings.lvm.enabled = true
          settings.lvm.system_vg_devices = ["/dev/sdb", "/dev/sdc"]
        end

        it "sets the system VG devices as candidate devices" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            candidate_devices: contain_exactly("/dev/sdb", "/dev/sdc")
          )
        end
      end

      context "and no system VG devices are indicated" do
        before do
          settings.boot_device = "/dev/sda"
          settings.target_device = "/dev/sdb"
          settings.lvm.enabled = true
          settings.lvm.system_vg_devices = []
        end

        it "does not set the candidate devices" do
          y2storage_settings = subject.convert

          expect(y2storage_settings).to have_attributes(
            candidate_devices: []
          )
        end
      end

      context "and a volume indicates a device" do
        before do
          volume = settings.volumes.find { |v| v.mount_path == "/test" }
          volume.device = "/dev/sda"
          settings.target_device = "/dev/sdb"
          settings.lvm.system_vg_devices = ["/dev/sdc"]
        end

        it "keeps the device of the volume" do
          y2storage_settings = subject.convert
          y2storage_volume = y2storage_settings.volumes.find { |v| v.mount_point == "/test" }

          expect(y2storage_volume).to have_attributes(
            device: "/dev/sda"
          )
        end
      end

      context "and a volume does not indicate a device" do
        before do
          volume = settings.volumes.find { |v| v.mount_path == "/test" }
          volume.device = nil
          settings.target_device = "/dev/sdb"
          settings.lvm.system_vg_devices = ["/dev/sdc"]
        end

        it "does not set a device to the volume" do
          y2storage_settings = subject.convert
          y2storage_volume = y2storage_settings.volumes.find { |v| v.mount_point == "/test" }

          expect(y2storage_volume).to have_attributes(
            device: be_nil
          )
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

        it "generates delete actions for all used devices" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.space_settings).to have_attributes(
            strategy: :bigger_resize,
            actions:  {
              "/dev/sda1" => :force_delete,
              "/dev/sda2" => :force_delete,
              "/dev/sda3" => :force_delete,
              "/dev/sdb"  => :force_delete,
              "/dev/sdc"  => :force_delete
            }
          )
        end
      end

      context "when the space policy is set to :resize" do
        before do
          settings.space.policy = :resize
        end

        it "generates resize actions for all used devices" do
          y2storage_settings = subject.convert

          expect(y2storage_settings.space_settings).to have_attributes(
            strategy: :bigger_resize,
            actions:  {
              "/dev/sda1" => :resize,
              "/dev/sda2" => :resize,
              "/dev/sda3" => :resize,
              "/dev/sdb"  => :resize,
              "/dev/sdc"  => :resize
            }
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
