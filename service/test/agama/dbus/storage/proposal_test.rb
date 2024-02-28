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

require_relative "../../../test_helper"
require "agama/dbus/storage/proposal"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "agama/storage/volume"
require "y2storage"

describe Agama::DBus::Storage::Proposal do
  subject { described_class.new(backend, logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:backend) do
    instance_double(Agama::Storage::Proposal, settings: settings)
  end

  let(:settings) { nil }

  describe "#target_device" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty string" do
        expect(subject.target_device).to eq ""
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.target_device = "/dev/vda" }
      end

      it "returns the target device used by the proposal" do
        expect(subject.target_device).to eq "/dev/vda"
      end
    end
  end

  describe "#boot_device" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty string" do
        expect(subject.boot_device).to eq ""
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.boot_device = "/dev/vda" }
      end

      it "returns the boot device used by the proposal" do
        expect(subject.boot_device).to eq "/dev/vda"
      end
    end
  end

  describe "#lvm" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns false" do
        expect(subject.lvm).to eq(false)
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.lvm.enabled = true }
      end

      it "return whether LVM was used" do
        expect(subject.lvm).to eq(true)
      end
    end
  end

  describe "#system_vg_devices" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty list" do
        expect(subject.system_vg_devices).to eq([])
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.lvm.system_vg_devices = ["/dev/vda"] }
      end

      it "returns the devices used for the system VG" do
        expect(subject.system_vg_devices).to contain_exactly("/dev/vda")
      end
    end
  end

  describe "#encryption_password" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty string" do
        expect(subject.encryption_password).to eq("")
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.encryption.password = "n0ts3cr3t" }
      end

      it "return the encryption password used by the proposal" do
        expect(subject.encryption_password).to eq("n0ts3cr3t")
      end
    end
  end

  describe "#encryption_method" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty string" do
        expect(subject.encryption_method).to eq("")
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.encryption.method = luks2 }
      end

      let(:luks2) { Y2Storage::EncryptionMethod::LUKS2 }

      it "return the encryption method used by the proposal" do
        expect(subject.encryption_method).to eq(luks2.id.to_s)
      end
    end
  end

  describe "#encryption_pbkd_function" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty string" do
        expect(subject.encryption_pbkd_function).to eq("")
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.encryption.pbkd_function = argon2id }
      end

      let(:argon2id) { Y2Storage::PbkdFunction::ARGON2ID }

      it "return the encryption method used by the proposal" do
        expect(subject.encryption_pbkd_function).to eq(argon2id.value)
      end
    end
  end

  describe "#space_policy" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty string" do
        expect(subject.space_policy).to eq("")
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap { |s| s.space.policy = :delete }
      end

      it "return the space policy used by the proposal" do
        expect(subject.space_policy).to eq("delete")
      end
    end
  end

  describe "#space_actions" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty list" do
        expect(subject.space_actions).to eq([])
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        Agama::Storage::ProposalSettings.new.tap do |settings|
          settings.space.actions = {
            "/dev/vda1" => :force_delete,
            "/dev/vda2" => :resize
          }
        end
      end

      it "return a list with a hash for each action" do
        expect(subject.space_actions).to contain_exactly(
          { "Device" => "/dev/vda1", "Action" => "force_delete" },
          { "Device" => "/dev/vda2", "Action" => "resize" }
        )
      end
    end
  end

  describe "#volumes" do
    let(:settings) do
      Agama::Storage::ProposalSettings.new.tap { |s| s.volumes = calculated_volumes }
    end

    context "if the calculated settings has no volumes" do
      let(:calculated_volumes) { [] }

      it "returns an empty list" do
        expect(subject.volumes).to eq([])
      end
    end

    context "if the calculated settings has volumes" do
      let(:calculated_volumes) { [calculated_volume1, calculated_volume2] }
      let(:calculated_volume1) { Agama::Storage::Volume.new("/test1") }
      let(:calculated_volume2) { Agama::Storage::Volume.new("/test2") }

      it "returns a list with a hash for each volume" do
        expect(subject.volumes.size).to eq(2)
        expect(subject.volumes).to all(be_a(Hash))

        volume1, volume2 = subject.volumes

        expect(volume1).to include("MountPath" => "/test1")
        expect(volume2).to include("MountPath" => "/test2")
      end
    end
  end

  describe "#actions" do
    before do
      allow(backend).to receive(:actions).and_return(actions)
    end

    context "if there are no actions" do
      let(:actions) { [] }

      it "returns an empty list" do
        expect(subject.actions).to eq([])
      end
    end

    context "if there are actions" do
      let(:actions) { [action1, action2] }

      let(:action1) do
        instance_double(Y2Storage::CompoundAction,
          sentence: "test1", device_is?: false, delete?: false)
      end

      let(:action2) do
        instance_double(Y2Storage::CompoundAction,
          sentence: "test2", device_is?: true, delete?: true)
      end

      it "returns a list with a hash for each action" do
        expect(subject.actions.size).to eq(2)
        expect(subject.actions).to all(be_a(Hash))

        action1, action2 = subject.actions

        expect(action1).to eq({
          "Text"   => "test1",
          "Subvol" => false,
          "Delete" => false
        })

        expect(action2).to eq({
          "Text"   => "test2",
          "Subvol" => true,
          "Delete" => true
        })
      end
    end
  end
end
