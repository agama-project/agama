# frozen_string_literal: true

# Copyright (c) [2022-2024] SUSE LLC
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

require_relative "../../test_helper"
require "agama/config"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_reader"
require "y2storage"

describe Agama::Storage::ProposalSettingsReader do
  let(:config) { Agama::Config.new(config_data) }

  subject { described_class.new(config) }

  describe "#read" do
    context "when the config does not contain storage section" do
      let(:config_data) { {} }

      it "generates proposal settings with default values" do
        settings = subject.read

        expect(settings).to be_a(Agama::Storage::ProposalSettings)
        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to be_nil
        expect(settings.boot.device).to be_nil
        expect(settings.encryption.password).to be_nil
        expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::PBKDF2)
        expect(settings.space.policy).to eq(:keep)
        expect(settings.space.actions).to eq({})
        expect(settings.volumes).to be_empty
      end
    end

    context "when the config contains a storage section" do
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

      it "generates proposal settings from the config" do
        settings = subject.read

        expect(settings).to be_a(Agama::Storage::ProposalSettings)
        expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
        expect(settings.device.name).to be_nil
        expect(settings.boot.device).to be_nil
        expect(settings.encryption.password).to be_nil
        expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2ID)
        expect(settings.space.policy).to eq(:delete)
        expect(settings.space.actions).to eq({})
        expect(settings.volumes).to contain_exactly(
          an_object_having_attributes(mount_path: "/"),
          an_object_having_attributes(mount_path: "swap")
        )
      end

      context "if lvm is disabled" do
        before do
          config_data["storage"]["lvm"] = false
        end

        it "generates device settings to use a disk as target device" do
          settings = subject.read

          expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
          expect(settings.device.name).to be_nil
        end
      end

      context "if lvm is enabled" do
        before do
          config_data["storage"]["lvm"] = true
        end

        it "generates device settings to use a new LVM volume group as target device" do
          settings = subject.read

          expect(settings.device).to be_a(Agama::Storage::DeviceSettings::NewLvmVg)
          expect(settings.device.candidate_pv_devices).to be_empty
        end
      end

      context "if the encryption method is unknown" do
        before do
          config_data["storage"]["encryption"]["method"] = "fooenc"
        end

        it "uses the default encryption method" do
          settings = subject.read

          expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
        end
      end

      context "if the password derivation function is unknown" do
        before do
          config_data["storage"]["encryption"]["pbkd_function"] = "foo"
        end

        it "uses the default derivation function" do
          settings = subject.read

          expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::PBKDF2)
        end
      end

      context "if the space policy is unknown" do
        before do
          config_data["storage"]["space_policy"] = "foo"
        end

        it "uses the default space policy" do
          settings = subject.read

          expect(settings.space.policy).to eq(:keep)
        end
      end
    end
  end
end
