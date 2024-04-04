# frozen_string_literal: true

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

require_relative "../../../../test_helper"
require "agama/dbus/storage/proposal_settings_conversion/to_dbus"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "agama/storage/volume"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

describe Agama::DBus::Storage::ProposalSettingsConversion::ToDBus do
  let(:default_settings) { Agama::Storage::ProposalSettings.new }

  let(:custom_settings) do
    Agama::Storage::ProposalSettings.new.tap do |settings|
      settings.device.name = "/dev/sda"
      settings.boot.device = "/dev/sdb"
      settings.encryption.password = "notsecret"
      settings.encryption.method = Y2Storage::EncryptionMethod::LUKS2
      settings.encryption.pbkd_function = Y2Storage::PbkdFunction::ARGON2ID
      settings.space.policy = :custom
      settings.space.actions = { "/dev/sda" => :force_delete, "/dev/sdb1" => "resize" }
      settings.volumes = [Agama::Storage::Volume.new("/test")]
    end
  end

  describe "#convert" do
    it "converts the settings to a D-Bus hash" do
      expect(described_class.new(default_settings).convert).to eq(
        "Target"                 => "disk",
        "TargetDevice"           => "",
        "ConfigureBoot"          => true,
        "BootDevice"             => "",
        "DefaultBootDevice"      => "",
        "EncryptionPassword"     => "",
        "EncryptionMethod"       => "luks2",
        "EncryptionPBKDFunction" => "pbkdf2",
        "SpacePolicy"            => "keep",
        "SpaceActions"           => [],
        "Volumes"                => []
      )

      expect(described_class.new(custom_settings).convert).to eq(
        "Target"                 => "disk",
        "TargetDevice"           => "/dev/sda",
        "ConfigureBoot"          => true,
        "BootDevice"             => "/dev/sdb",
        "DefaultBootDevice"      => "/dev/sda",
        "EncryptionPassword"     => "notsecret",
        "EncryptionMethod"       => "luks2",
        "EncryptionPBKDFunction" => "argon2id",
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
          {
            "MountPath"     => "/test",
            "MountOptions"  => [],
            "TargetDevice"  => "",
            "Target"        => "default",
            "FsType"        => "",
            "MinSize"       => 0,
            "AutoSize"      => false,
            "Snapshots"     => false,
            "Transactional" => false,
            "Outline"       => {
              "Required"              => false,
              "FsTypes"               => [],
              "SupportAutoSize"       => false,
              "SnapshotsConfigurable" => false,
              "SnapshotsAffectSizes"  => false,
              "AdjustByRam"           => false,
              "SizeRelevantVolumes"   => []
            }
          }
        ]
      )
    end

    context "when the device is set to create partitions" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.device = Agama::Storage::DeviceSettings::Disk.new("/dev/vda")
        end
      end

      it "generates settings to use a disk as target device" do
        dbus_settings = described_class.new(settings).convert

        expect(dbus_settings).to include(
          "Target"       => "disk",
          "TargetDevice" => "/dev/vda"
        )

        expect(dbus_settings).to_not include("TargetPVDevices")
      end
    end

    context "when the device is set to create a new LVM volume group" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.device = Agama::Storage::DeviceSettings::NewLvmVg.new(["/dev/vda"])
        end
      end

      it "generates settings to create a LVM volume group as target device" do
        dbus_settings = described_class.new(settings).convert

        expect(dbus_settings).to include(
          "Target"          => "newLvmVg",
          "TargetPVDevices" => ["/dev/vda"]
        )

        expect(dbus_settings).to_not include("TargetDevice")
      end
    end

    context "when the device is set to reuse a LVM volume group" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.device = Agama::Storage::DeviceSettings::ReusedLvmVg.new("/dev/vg0")
        end
      end

      it "generates settings to reuse a LVM volume group as target device" do
        dbus_settings = described_class.new(settings).convert

        expect(dbus_settings).to include(
          "Target"       => "reusedLvmVg",
          "TargetDevice" => "/dev/vg0"
        )

        expect(dbus_settings).to_not include("TargetPVDevices")
      end
    end
  end
end
