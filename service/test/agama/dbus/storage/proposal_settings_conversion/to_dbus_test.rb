# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require "y2storage/encryption_method"
require "y2storage/pbkd_function"
require "agama/dbus/storage/proposal_settings_conversion/to_dbus"
require "agama/storage/proposal_settings"
require "agama/storage/volume"

describe Agama::DBus::Storage::ProposalSettingsConversion::ToDBus do
  let(:default_settings) { Agama::Storage::ProposalSettings.new }

  let(:custom_settings) do
    Agama::Storage::ProposalSettings.new.tap do |settings|
      settings.boot_device = "/dev/sda"
      settings.lvm.enabled = true
      settings.lvm.system_vg_devices = ["/dev/sda", "/dev/sdb"]
      settings.encryption.password = "notsecret"
      settings.encryption.method = Y2Storage::EncryptionMethod::LUKS2
      settings.encryption.pbkd_function = Y2Storage::PbkdFunction::ARGON2ID
      settings.space.policy = :custom
      settings.space.actions = { "/dev/sda" => :force_delete }
      settings.volumes = [Agama::Storage::Volume.new("/test")]
    end
  end

  describe "#convert" do
    it "converts the settings to a D-Bus hash" do
      expect(described_class.new(default_settings).convert).to eq(
        "BootDevice"             => "",
        "LVM"                    => false,
        "SystemVGDevices"        => [],
        "EncryptionPassword"     => "",
        "EncryptionMethod"       => "luks1",
        "EncryptionPBKDFunction" => "",
        "SpacePolicy"            => "keep",
        "SpaceActions"           => {},
        "Volumes"                => []
      )

      expect(described_class.new(custom_settings).convert).to eq(
        "BootDevice"             => "/dev/sda",
        "LVM"                    => true,
        "SystemVGDevices"        => ["/dev/sda", "/dev/sdb"],
        "EncryptionPassword"     => "notsecret",
        "EncryptionMethod"       => "luks2",
        "EncryptionPBKDFunction" => "argon2id",
        "SpacePolicy"            => "custom",
        "SpaceActions"           => { "/dev/sda" => :force_delete },
        "Volumes"                => [
          {
            "MountPath"     => "/test",
            "MountOptions"  => [],
            "TargetDevice"  => "",
            "TargetVG"      => "",
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
              "SizeRelevantVolumes"   => []
            }
          }
        ]
      )
    end
  end
end
