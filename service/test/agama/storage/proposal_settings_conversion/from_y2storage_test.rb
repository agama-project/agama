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
require "agama/storage/proposal_settings_conversion/from_y2storage"
require "agama/config"
require "y2storage"

describe Agama::Storage::ProposalSettingsConversion::FromY2Storage do
  subject { described_class.new(y2storage_settings, config: config) }

  let(:config) { Agama::Config.new }

  describe "#convert" do
    let(:y2storage_settings) do
      Y2Storage::ProposalSettings.new.tap do |settings|
        settings.root_device = "/dev/sda"
        settings.lvm = false
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
        boot_device: "/dev/sda",
        lvm:         an_object_having_attributes(
          enabled:           false,
          system_vg_devices: []
        ),
        encryption:  an_object_having_attributes(
          password:      "notsecret",
          method:        Y2Storage::EncryptionMethod::LUKS2,
          pbkd_function: Y2Storage::PbkdFunction::ARGON2ID
        ),
        space:       an_object_having_attributes(
          actions: { "/dev/sda" => :force_delete, "/dev/sdb1" => :resize }
        ),
        volumes:     []
      )
    end

    context "LVM settings conversion" do
      before do
        y2storage_settings.root_device = "/dev/sda"
        y2storage_settings.candidate_devices = candidate_devices
      end

      context "when the candidate devices only includes the root device" do
        let(:candidate_devices) { ["/dev/sda"] }

        it "does not set system VG devices" do
          settings = subject.convert

          expect(settings).to have_attributes(
            lvm: an_object_having_attributes(
              system_vg_devices: []
            )
          )
        end
      end

      context "when the candidate devices includes the root device and other devices" do
        let(:candidate_devices) { ["/dev/sda", "/dev/sdb"] }

        it "sets the candidate devices as system VG devices" do
          settings = subject.convert

          expect(settings).to have_attributes(
            lvm: an_object_having_attributes(
              system_vg_devices: contain_exactly("/dev/sda", "/dev/sdb")
            )
          )
        end
      end

      context "when the candidate devices only includes other devices" do
        let(:candidate_devices) { ["/dev/sdb", "/dev/sdc"] }

        it "sets the candidate devices as system VG devices" do
          settings = subject.convert

          expect(settings).to have_attributes(
            lvm: an_object_having_attributes(
              system_vg_devices: contain_exactly("/dev/sdb", "/dev/sdc")
            )
          )
        end

        it "does not set the root device as system VG device" do
          settings = subject.convert

          expect(settings.lvm.system_vg_devices).to_not include("/dev/sda")
        end
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
