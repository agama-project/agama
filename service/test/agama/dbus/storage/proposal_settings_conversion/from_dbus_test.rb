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

require_relative "../../../../test_helper"
require "agama/dbus/storage/proposal_settings_conversion/from_dbus"
require "agama/config"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

describe Agama::DBus::Storage::ProposalSettingsConversion::FromDBus do
  subject { described_class.new(dbus_settings, config: config, logger: logger) }

  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    {
      "storage" => {
        "lvm"              => false,
        "space_policy"     => "delete",
        "encryption"       => {
          "method"        => "luks2",
          "pbkd_function" => "argon2id"
        },
        "volumes"          => ["/", "swap"],
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
          }
        ]
      }
    }
  end

  let(:logger) { Logger.new($stdout, level: :warn) }

  before do
    allow(Agama::Storage::EncryptionSettings)
      .to receive(:available_methods).and_return(
        [
          Y2Storage::EncryptionMethod::LUKS1,
          Y2Storage::EncryptionMethod::LUKS2
        ]
      )
  end

  describe "#convert" do
    let(:dbus_settings) do
      {
        "Target"                 => "disk",
        "TargetDevice"           => "/dev/sda",
        "ConfigureBoot"          => true,
        "BootDevice"             => "/dev/sdb",
        "EncryptionPassword"     => "notsecret",
        "EncryptionMethod"       => "luks1",
        "EncryptionPBKDFunction" => "pbkdf2",
        "SpacePolicy"            => "custom",
        "SpaceActions"           => [
          {
            "Device" => "/dev/sda",
            "Action" => "force_delete"
          },
          {
            "Device" => "/dev/sdb1",
            "Action" => "resize"
          }
        ],
        "Volumes"                => [
          { "MountPath" => "/" },
          { "MountPath" => "/test" }
        ]
      }
    end

    it "generates proposal settings with the values provided from D-Bus" do
      settings = subject.convert

      expect(settings).to be_a(Agama::Storage::ProposalSettings)
      expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
      expect(settings.device.name).to eq("/dev/sda")
      expect(settings.boot.configure?).to eq(true)
      expect(settings.boot.device).to eq("/dev/sdb")
      expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
      expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::PBKDF2)
      expect(settings.space.policy).to eq(:custom)
      expect(settings.space.actions).to eq({
        "/dev/sda" => :force_delete, "/dev/sdb1" => :resize
      })
      expect(settings.volumes).to contain_exactly(
        an_object_having_attributes(mount_path: "/"),
        an_object_having_attributes(mount_path: "/test")
      )
    end

    context "when some values are not provided from D-Bus" do
      let(:dbus_settings) { {} }

      it "completes missing values with default values from config" do
        settings = subject.convert

        expect(settings).to be_a(Agama::Storage::ProposalSettings)
        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to be_nil
        expect(settings.boot.configure?).to eq(true)
        expect(settings.boot.device).to be_nil
        expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2ID)
        expect(settings.space.policy).to eq(:delete)
        expect(settings.volumes).to contain_exactly(
          an_object_having_attributes(mount_path: "/"),
          an_object_having_attributes(mount_path: "swap")
        )
      end
    end

    context "when 'Target' is not provided from D-Bus" do
      let(:dbus_settings) { {} }

      it "sets device settings to create partitions" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to be_nil
      end
    end

    context "when 'Target' has 'disk' value" do
      let(:dbus_settings) do
        {
          "Target"       => "disk",
          "TargetDevice" => "/dev/vda"
        }
      end

      it "sets device settings to create partitions in the indicated device" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to eq("/dev/vda")
      end
    end

    context "when 'Target' has 'newLvmVg' value" do
      let(:dbus_settings) do
        {
          "Target"          => "newLvmVg",
          "TargetPVDevices" => ["/dev/vda", "/dev/vdb"]
        }
      end

      it "sets device settings to create a new LVM volume group in the indicated devices" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::NewLvmVg)
        expect(settings.device.candidate_pv_devices).to contain_exactly("/dev/vda", "/dev/vdb")
      end
    end

    context "when 'Target' has 'reusedLvmVg' value" do
      let(:dbus_settings) do
        {
          "Target"       => "reusedLvmVg",
          "TargetDevice" => "/dev/vg0"
        }
      end

      it "sets device settings to reuse the indicated LVM volume group" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::ReusedLvmVg)
        expect(settings.device.name).to eq("/dev/vg0")
      end
    end

    context "when some value provided from D-Bus has unexpected type" do
      let(:dbus_settings) { { "BootDevice" => 1 } }

      it "ignores the value" do
        settings = subject.convert

        expect(settings.boot.device).to be_nil
      end
    end

    context "when some unexpected setting is provided from D-Bus" do
      let(:dbus_settings) { { "Foo" => 1 } }

      it "does not fail" do
        settings = subject.convert

        expect(settings).to be_a(Agama::Storage::ProposalSettings)
      end
    end

    context "when volumes are not provided from D-Bus" do
      let(:dbus_settings) { { "Volumes" => [] } }

      it "completes the volumes with the default volumes from config" do
        settings = subject.convert
        expect(settings.volumes).to contain_exactly(
          an_object_having_attributes(mount_path: "/"),
          an_object_having_attributes(mount_path: "swap")
        )
      end

      it "ignores templates of non-default volumes" do
        settings = subject.convert
        expect(settings.volumes).to_not include(
          an_object_having_attributes(mount_path: "/home")
        )
      end
    end

    context "when a mandatory volume is not provided from D-Bus" do
      let(:dbus_settings) do
        {
          "Volumes" => [
            { "MountPath" => "/test" }
          ]
        }
      end

      it "completes the volumes with the mandatory volumes" do
        settings = subject.convert
        expect(settings.volumes).to include(
          an_object_having_attributes(mount_path: "/")
        )
      end

      it "includes the volumes provided from D-Bus" do
        settings = subject.convert
        expect(settings.volumes).to include(
          an_object_having_attributes(mount_path: "/test")
        )
      end

      it "ignores default volumes that are not mandatory" do
        settings = subject.convert
        expect(settings.volumes).to_not include(
          an_object_having_attributes(mount_path: "swap")
        )
      end

      it "ignores templates for excluded volumes" do
        settings = subject.convert
        expect(settings.volumes).to_not include(
          an_object_having_attributes(mount_path: "/home")
        )
      end
    end
  end
end
