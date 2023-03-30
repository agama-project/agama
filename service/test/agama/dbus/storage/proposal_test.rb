# frozen_string_literal: true

# Copyright (c) [2022-2023] SUSE LLC
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
    instance_double(Agama::Storage::Proposal, calculated_settings: settings)
  end

  let(:settings) { nil }

  describe "#candidate_devices" do
    context "if a proposal has not been calculated yet" do
      let(:settings) { nil }

      it "returns an empty list" do
        expect(subject.candidate_devices).to eq([])
      end
    end

    context "if a proposal has been calculated" do
      let(:settings) do
        instance_double(Agama::Storage::ProposalSettings,
          candidate_devices: ["/dev/vda", "/dev/vdb"])
      end

      it "returns the candidate devices used by the proposal" do
        expect(subject.candidate_devices).to contain_exactly("/dev/vda", "/dev/vdb")
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
        instance_double(Agama::Storage::ProposalSettings, lvm: true)
      end

      it "return whether LVM was used" do
        expect(subject.lvm).to eq(true)
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
        instance_double(Agama::Storage::ProposalSettings, encryption_password: "n0ts3cr3t")
      end

      it "return the encryption password used by the proposal" do
        expect(subject.encryption_password).to eq("n0ts3cr3t")
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

      let(:calculated_volume1) do
        Agama::Storage::Volume.new.tap do |volume|
          volume.mount_point = "/test1"
        end
      end

      let(:calculated_volume2) do
        Agama::Storage::Volume.new.tap do |volume|
          volume.mount_point = "/test2"
        end
      end

      it "returns a list with a hash for each volume" do
        expect(subject.volumes.size).to eq(2)
        expect(subject.volumes).to all(be_a(Hash))

        volume1, volume2 = subject.volumes

        expect(volume1).to include("MountPoint" => "/test1")
        expect(volume2).to include("MountPoint" => "/test2")
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
