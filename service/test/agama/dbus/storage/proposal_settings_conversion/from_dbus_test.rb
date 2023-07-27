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
require "agama/config"
require "agama/storage/proposal_settings"
require "agama/dbus/storage/proposal_settings_conversion/from_dbus"

describe Agama::DBus::Storage::ProposalSettingsConversion::FromDBus do
  subject { described_class.new(dbus_settings, config: config) }

  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    {
      "storage" => {
        "lvm" => true,
        "encryption" => {
          "method" => "luks2",
          "pbkd_function" => "argon2id"
        },
        "space_policy" => "delete",
        "volumes" => [
          { "mount_path" => "/" }
        ],
        "volume_templates" => [
          {
            "mount_path" => "/",
            "outline" => {
              "required" => true
            }
          },
          {
            "mount_path" => "swap",
            "outline" => {
              "required" => false
            }
          }
        ]
      }
    }
  end

  describe "#convert" do
    let(:dbus_settings) do
      {
        "BootDevice"             => "/dev/sda",
        "LVM"                    => true,
        "SystemVGDevices"        => ["/dev/sda", "/dev/sdb"],
        "EncryptionPassword"     => "notsecret",
        "EncryptionMethod"       => "luks1",
        "EncryptionPBKDFunction" => "pbkdf2",
        "SpacePolicy"            => "custom",
        "SpaceActions"           => { "/dev/sda" => "force_delete" },
        "Volumes"                => [
          { "MountPath" => "/test" }
        ]
      }
    end

    it "generates proposal settings from D-Bus values" do
      settings = subject.convert

      expect(settings).to be_a(Agama::Storage::ProposalSettings)
      expect(settings.boot_device).to eq("/dev/sda")
      expect(settings.lvm.enabled).to eq(true)
      expect(settings.lvm.system_vg_devices).to contain_exactly("/dev/sda", "/dev/sdb")
      expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS1)
      expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::PBKDF2)
      expect(settings.space.policy).to eq(:custom)
      expect(settings.space.actions).to eq({ "/dev/sda" => "force_delete" })
      expect(settings.volumes.map(&:mount_path)).to include("/test")
    end

    it "adds missing required volumes" do
      settings = subject.convert

      expect(settings.volumes.map(&:mount_path)).to contain_exactly("/", "/test")
    end

    context "when a value is not provided from D-Bus" do
      let(:dbus_settings) { {} }

      it "generates proposal settings with default values from config" do
        settings = subject.convert

        expect(settings).to be_a(Agama::Storage::ProposalSettings)
        expect(settings.boot_device).to be_nil
        expect(settings.lvm.enabled).to eq(true)
        expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2ID)
        expect(settings.space.policy).to eq(:delete)
        expect(settings.volumes.map(&:mount_path)).to contain_exactly("/")
      end
    end
  end
end
