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
require "agama/config"
require "agama/storage/proposal_settings"
require "agama/storage/proposal_settings_conversions/from_y2storage"
require "y2storage"

describe Agama::Storage::ProposalSettingsConversions::FromY2Storage do
  subject { described_class.new(y2storage_settings, original_settings) }

  let(:y2storage_settings) do
    Y2Storage::ProposalSettings.new.tap do |settings|
      settings.space_settings.actions = [
        Y2Storage::SpaceActions::Delete.new("/dev/sda", mandatory: true),
        Y2Storage::SpaceActions::Resize.new("/dev/sdb1"),
        Y2Storage::SpaceActions::Delete.new("/dev/sdb2")
      ]
    end
  end

  let(:original_settings) do
    Agama::Storage::ProposalSettings.new.tap do |settings|
      settings.device.name = "/dev/sda"
      settings.boot.device = "/dev/sdb"
      settings.encryption.password = "notsecret"
      settings.encryption.method = Y2Storage::EncryptionMethod::LUKS2
      settings.encryption.pbkd_function = Y2Storage::PbkdFunction::ARGON2ID
      settings.space.policy = :delete
      settings.space.actions = {}
      settings.volumes = [Agama::Storage::Volume.new("/test")]
    end
  end

  describe "#convert" do
    it "generates settings with the same values as the given settings" do
      settings = subject.convert

      expect(settings).to be_a(Agama::Storage::ProposalSettings)
      expect(settings.device).to be_a(Agama::Storage::DeviceSettings::Disk)
      expect(settings.device.name).to eq("/dev/sda")
      expect(settings.boot.device).to eq("/dev/sdb")
      expect(settings.encryption.password).to eq("notsecret")
      expect(settings.encryption.method).to eq(Y2Storage::EncryptionMethod::LUKS2)
      expect(settings.encryption.pbkd_function).to eq(Y2Storage::PbkdFunction::ARGON2ID)
      expect(settings.space.policy).to eq(:delete)
      expect(settings.volumes).to contain_exactly(
        an_object_having_attributes(mount_path: "/test")
      )
    end

    it "restores the space actions from Y2Storage" do
      settings = subject.convert

      expect(settings.space.actions).to eq(
        "/dev/sda"  => :force_delete,
        "/dev/sdb1" => :resize,
        "/dev/sdb2" => :delete
      )
    end
  end
end
