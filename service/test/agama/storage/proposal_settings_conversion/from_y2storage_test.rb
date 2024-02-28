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
require "agama/storage/proposal_settings_conversion/from_y2storage"
require "y2storage"

describe Agama::Storage::ProposalSettingsConversion::FromY2Storage do
  subject { described_class.new(y2storage_settings, config: config, backup: backup) }

  let(:config) { Agama::Config.new }

  let(:backup) { nil }

  describe "#convert" do
    let(:y2storage_settings) do
      Y2Storage::ProposalSettings.new.tap do |settings|
        settings.root_device = "/dev/sda"
        settings.lvm = true
        settings.candidate_devices = ["/dev/sda"]
        settings.encryption_password = "notsecret"
        settings.encryption_method = Y2Storage::EncryptionMethod::LUKS2
        settings.encryption_pbkdf = Y2Storage::PbkdFunction::ARGON2ID
        settings.space_settings.actions = {
          "/dev/sda"  => :force_delete,
          "/dev/sdb1" => :resize
        }
        settings.volumes = []
      end
    end

    it "converts the Y2Storage settings to Agama settings" do
      settings = subject.convert

      expect(settings).to be_a(Agama::Storage::ProposalSettings)
      expect(settings).to have_attributes(
        target_device: "/dev/sda",
        boot_device:   nil,
        lvm:           an_object_having_attributes(
          enabled:           true,
          system_vg_devices: ["/dev/sda"]
        ),
        encryption:    an_object_having_attributes(
          password:      "notsecret",
          method:        Y2Storage::EncryptionMethod::LUKS2,
          pbkd_function: Y2Storage::PbkdFunction::ARGON2ID
        ),
        space:         an_object_having_attributes(
          policy:  :custom,
          actions: { "/dev/sda" => :force_delete, "/dev/sdb1" => :resize }
        ),
        volumes:       []
      )
    end

    context "Target device conversion" do
      let(:backup) do
        Agama::Storage::ProposalSettings.new.tap do |backup|
          backup.lvm.enabled = lvm
          backup.target_device = "/dev/sdb"
        end
      end

      before do
        y2storage_settings.root_device = "/dev/sda"
      end

      context "if LVM was not enabled" do
        let(:lvm) { false }

        it "restores the target device from the settings backup" do
          settings = subject.convert

          expect(settings).to have_attributes(
            target_device: "/dev/sdb"
          )
        end
      end

      context "if LVM was enabled" do
        let(:lvm) { true }

        it "sets the root device as the target device" do
          settings = subject.convert

          expect(settings).to have_attributes(
            target_device: "/dev/sda"
          )
        end
      end
    end

    context "Boot device conversion" do
      let(:backup) do
        Agama::Storage::ProposalSettings.new.tap do |backup|
          backup.boot_device = "/dev/sdb"
        end
      end

      before do
        y2storage_settings.root_device = "/dev/sda"
      end

      it "restores the boot device from the settings backup" do
        settings = subject.convert

        expect(settings).to have_attributes(
          boot_device: "/dev/sdb"
        )
      end
    end

    context "LVM settings conversion" do
      context "when LVM is not enabled" do
        before do
          y2storage_settings.lvm = false
        end

        it "does not set system VG devices" do
          settings = subject.convert

          expect(settings).to have_attributes(
            lvm: an_object_having_attributes(
              system_vg_devices: []
            )
          )
        end
      end

      context "when LVM is enabled" do
        before do
          y2storage_settings.lvm = true
        end

        it "sets the candidate devices as system VG devices" do
          settings = subject.convert

          expect(settings).to have_attributes(
            lvm: an_object_having_attributes(
              system_vg_devices: contain_exactly("/dev/sda")
            )
          )
        end
      end
    end

    context "Space policy conversion" do
      let(:backup) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.space.policy = :resize
        end
      end

      it "restores the space policy from the settings backup" do
        settings = subject.convert

        expect(settings).to have_attributes(
          space: an_object_having_attributes(
            policy: :resize
          )
        )
      end
    end

    context "volumes conversion" do
      before do
        y2storage_settings.volumes = [spec1, spec2, spec3]
      end

      let(:spec1) do
        Y2Storage::VolumeSpecification.new({}).tap do |spec|
          spec.mount_point = "/"
          spec.proposed = true
        end
      end

      let(:spec2) do
        Y2Storage::VolumeSpecification.new({}).tap do |spec|
          spec.mount_point = "/home"
          spec.proposed = true
          spec.fallback_for_min_size = "/"
          spec.fallback_for_max_size = "/"
        end
      end

      let(:spec3) do
        Y2Storage::VolumeSpecification.new({}).tap do |spec|
          spec.mount_point = "swap"
          spec.proposed = false
          spec.fallback_for_min_size = "/"
          spec.fallback_for_max_size = "/home"
        end
      end

      it "only includes volumes for the proposed specs" do
        settings = subject.convert

        expect(settings).to have_attributes(
          volumes: contain_exactly(
            an_object_having_attributes(mount_path: "/"),
            an_object_having_attributes(mount_path: "/home")
          )
        )
      end

      it "sets the fallbacks for min and max sizes" do
        settings = subject.convert

        expect(settings).to have_attributes(
          volumes: contain_exactly(
            an_object_having_attributes(
              mount_path:            "/",
              min_size_fallback_for: contain_exactly("/home", "swap"),
              max_size_fallback_for: contain_exactly("/home")
            ),
            an_object_having_attributes(
              mount_path:            "/home",
              min_size_fallback_for: be_empty,
              max_size_fallback_for: contain_exactly("swap")
            )
          )
        )
      end
    end
  end
end
