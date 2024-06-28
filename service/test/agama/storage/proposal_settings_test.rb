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

require_relative "../../test_helper"
require "agama/config"
require "agama/storage/device_settings"
require "agama/storage/proposal_settings"
require "agama/storage/volume"

describe Agama::Storage::ProposalSettings do
  describe "#default_boot_device" do
    context "when the device is configured to use a disk" do
      before do
        subject.device = Agama::Storage::DeviceSettings::Disk.new
      end

      context "and no device is selected yet" do
        before do
          subject.device.name = nil
        end

        it "returns nil" do
          expect(subject.default_boot_device).to be_nil
        end
      end

      context "and a device is selected" do
        before do
          subject.device.name = "/dev/sda"
        end

        it "returns the target device" do
          expect(subject.default_boot_device).to eq("/dev/sda")
        end
      end
    end

    context "when the device is configured to create a new LVM volume group" do
      before do
        subject.device = Agama::Storage::DeviceSettings::NewLvmVg.new
      end

      context "and no device is selected yet" do
        before do
          subject.device.candidate_pv_devices = []
        end

        it "returns nil" do
          expect(subject.default_boot_device).to be_nil
        end
      end

      context "and some candidate devices for creating the LVM physical volumes are selected" do
        before do
          subject.device.candidate_pv_devices = ["/dev/sdc", "/dev/sda", "/dev/sdb"]
        end

        it "returns the first candidate device in alphabetical order" do
          expect(subject.default_boot_device).to eq("/dev/sda")
        end
      end
    end
  end

  describe "#installation_devices" do
    shared_examples "boot device" do
      context "when boot is set to be configured" do
        before do
          subject.boot.configure = true
          subject.boot.device = "/dev/sdc"
        end

        it "includes the boot device" do
          expect(subject.installation_devices).to include("/dev/sdc")
        end
      end

      context "when boot is not set to be configured" do
        before do
          subject.boot.configure = false
          subject.boot.device = "/dev/sdc"
        end

        it "does not include the boot device" do
          expect(subject.installation_devices).to_not include("/dev/sdc")
        end
      end
    end

    shared_examples "volume devices" do
      before do
        subject.volumes = [volume1, volume2]
      end

      let(:volume1) do
        Agama::Storage::Volume.new("/").tap do |volume|
          volume.location.target = :new_partition
          volume.location.device = "/dev/sdd"
        end
      end

      let(:volume2) do
        Agama::Storage::Volume.new("/").tap do |volume|
          volume.location.target = :new_partition
          volume.location.device = "/dev/sde"
        end
      end

      it "includes the devices assigned to the volumes" do
        expect(subject.installation_devices).to include("/dev/sdd", "/dev/sde")
      end
    end

    context "when the device is configured to use a disk" do
      before do
        subject.device = Agama::Storage::DeviceSettings::Disk.new("/dev/sda")
      end

      it "includes the target device" do
        expect(subject.installation_devices).to include("/dev/sda")
      end

      include_examples "boot device"

      include_examples "volume devices"
    end

    context "when the device is configured to create a new LVM volume group" do
      before do
        subject.device = Agama::Storage::DeviceSettings::NewLvmVg.new(["/dev/sda", "/dev/sdb"])
      end

      it "includes the target devices for creating new LVM physical volumes" do
        expect(subject.installation_devices).to include("/dev/sda", "/dev/sdb")
      end

      include_examples "boot device"

      include_examples "volume devices"
    end

    context "when the device is configured to reuse a LVM volume group" do
      before do
        subject.device = Agama::Storage::DeviceSettings::ReusedLvmVg.new("/dev/vg0")
      end

      it "includes the target LVM volume group" do
        expect(subject.installation_devices).to include("/dev/vg0")
      end

      include_examples "boot device"

      include_examples "volume devices"
    end
  end

  describe ".new_from_json" do
    let(:config) { Agama::Config.new }

    let(:settings_json) do
      {
        target: {
          disk: "/dev/vda"
        }
      }
    end

    it "generates a proposal settings from JSON according to schema" do
      result = described_class.new_from_json(settings_json, config: config)
      expect(result).to be_a(Agama::Storage::ProposalSettings)
    end
  end

  describe "#to_json_settings" do
    let(:proposal_settings) { Agama::Storage::ProposalSettings.new }

    it "generates a JSON hash according to schema" do
      result = proposal_settings.to_json_settings
      expect(result).to be_a(Hash)
    end
  end
end
