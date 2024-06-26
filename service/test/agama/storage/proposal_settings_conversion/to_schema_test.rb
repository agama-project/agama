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
require "agama/storage/proposal_settings_conversion/to_schema"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "agama/storage/volume"
require "y2storage/encryption_method"
require "y2storage/pbkd_function"

describe Agama::Storage::ProposalSettingsConversion::ToSchema do
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
    it "converts the settings to the proper hash according to the JSON schema" do
      # @todo Check whether the result matches the JSON schema.

      expect(described_class.new(default_settings).convert).to eq(
        target:  "disk",
        boot:    {
          configure: true
        },
        space:   {
          policy:  "keep",
          actions: []
        },
        volumes: []
      )

      expect(described_class.new(custom_settings).convert).to eq(
        target:     {
          disk: "/dev/sda"
        },
        boot:       {
          configure: true,
          device:    "/dev/sdb"
        },
        encryption: {
          password:     "notsecret",
          method:       "luks2",
          pbkdFunction: "argon2id"
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
            mount:  {
              path:    "/test",
              options: []
            },
            size:   {
              min: 0
            },
            target: "default"
          }
        ]
      )
    end

    context "when the target is a new LVM volume group" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.device = Agama::Storage::DeviceSettings::NewLvmVg.new(["/dev/vda"])
        end
      end

      it "converts the settings to the proper hash according to the JSON schema" do
        expect(described_class.new(settings).convert).to eq(
          target:  {
            newLvmVg: ["/dev/vda"]
          },
          boot:    {
            configure: true
          },
          space:   {
            policy:  "keep",
            actions: []
          },
          volumes: []
        )
      end
    end
  end
end
