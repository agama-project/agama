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

require_relative "../../../test_helper"
require "agama/storage/proposal_settings_conversions/from_json"
require "agama/config"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

describe Agama::Storage::ProposalSettingsConversions::FromJSON do
  subject { described_class.new(settings_json, config: config) }

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
    let(:settings_json) do
      {
        target:     {
          disk: "/dev/sda"
        },
        boot:       {
          configure: true,
          device:    "/dev/sdb"
        },
        encryption: {
          password:     "notsecret",
          method:       "luks1",
          pbkdFunction: "pbkdf2"
        },
        space:      {
          policy:  "custom",
          actions: [
            { forceDelete: "/dev/sda" },
            { resize: "/dev/sdb1" }
          ]
        },
        volumes:    [
          {
            mount: {
              path: "/"
            }
          },
          {
            mount: {
              path: "/test"
            }
          }
        ]
      }
    end

    it "generates settings with the values provided from JSON" do
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

    context "when the JSON is missing some values" do
      let(:settings_json) { {} }

      it "completes the missing values with default values from the config" do
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

    context "when the JSON does not indicate the target" do
      let(:settings_json) { {} }

      it "generates settings with disk target and without specific device" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to be_nil
      end
    end

    context "when the JSON indicates disk target without device" do
      let(:settings_json) do
        {
          target: "disk"
        }
      end

      it "generates settings with disk target and without specific device" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to be_nil
      end
    end

    context "when the JSON indicates disk target with a device" do
      let(:settings_json) do
        {
          target: {
            disk: "/dev/vda"
          }
        }
      end

      it "generates settings with disk target and with specific device" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to eq("/dev/vda")
      end
    end

    context "when the JSON indicates newLvmVg target without devices" do
      let(:settings_json) do
        {
          target: "newLvmVg"
        }
      end

      it "generates settings with newLvmVg target and without specific devices" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::NewLvmVg)
        expect(settings.device.candidate_pv_devices).to eq([])
      end
    end

    context "when the JSON indicates newLvmVg target with devices" do
      let(:settings_json) do
        {
          target: {
            newLvmVg: ["/dev/vda", "/dev/vdb"]
          }
        }
      end

      it "generates settings with newLvmVg target and with specific devices" do
        settings = subject.convert

        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::NewLvmVg)
        expect(settings.device.candidate_pv_devices).to contain_exactly("/dev/vda", "/dev/vdb")
      end
    end

    context "when the JSON does not indicate volumes" do
      let(:settings_json) { { volumes: [] } }

      it "generates settings with the default volumes from config" do
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

    context "when the JSON does not contain a required volume" do
      let(:settings_json) do
        {
          volumes: [
            {
              mount: {
                path: "/test"
              }
            }
          ]
        }
      end

      it "generates settings including the required volumes" do
        settings = subject.convert

        expect(settings.volumes).to include(
          an_object_having_attributes(mount_path: "/")
        )
      end

      it "generates settings including the given volumes" do
        settings = subject.convert

        expect(settings.volumes).to include(
          an_object_having_attributes(mount_path: "/test")
        )
      end

      it "ignores default volumes that are not required" do
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
