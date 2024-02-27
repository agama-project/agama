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
require_relative "storage_helpers"
require "agama/config"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "y2storage"

describe Agama::Storage::Proposal do
  include Agama::RSpec::StorageHelpers

  before { mock_storage(devicegraph: "partitioned_md.yml") }

  subject(:proposal) { described_class.new(config, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:config) { Agama::Config.new }

  let(:achievable_settings) do
    Agama::Storage::ProposalSettings.new.tap do |settings|
      settings.boot_device = "/dev/sdb"
      settings.volumes = [Agama::Storage::Volume.new("/")]
    end
  end

  let(:impossible_settings) do
    Agama::Storage::ProposalSettings.new.tap do |settings|
      settings.boot_device = "/dev/sdb"
      settings.volumes = [
        # The boot disk size is 500 GiB, so it cannot accomodate a 1 TiB volume.
        Agama::Storage::Volume.new("/").tap { |v| v.min_size = Y2Storage::DiskSize.TiB(1) }
      ]
    end
  end

  describe "#success?" do
    it "returns false if calculate has not been called yet" do
      expect(subject.success?).to eq(false)
    end

    context "if calculate was already called" do
      before do
        subject.calculate(settings)
      end

      context "and the proposal was successful" do
        let(:settings) { achievable_settings }

        it "returns true" do
          expect(subject.success?).to eq(true)
        end
      end

      context "and the proposal failed" do
        let(:settings) { impossible_settings }

        it "returns false" do
          expect(subject.success?).to eq(false)
        end
      end
    end
  end

  describe "#calculate" do
    it "calculates a new proposal with the given settings" do
      expect(Y2Storage::StorageManager.instance.proposal).to be_nil

      subject.calculate(achievable_settings)

      expect(Y2Storage::StorageManager.instance.proposal).to_not be_nil
      expect(Y2Storage::StorageManager.instance.proposal.settings).to have_attributes(
        root_device: "/dev/sdb",
        volumes:     contain_exactly(
          an_object_having_attributes(mount_point: "/")
        )
      )
    end

    it "runs all the callbacks" do
      callback1 = proc {}
      callback2 = proc {}

      subject.on_calculate(&callback1)
      subject.on_calculate(&callback2)

      expect(callback1).to receive(:call)
      expect(callback2).to receive(:call)

      subject.calculate(achievable_settings)
    end

    it "returns whether the proposal was successful" do
      expect(subject.calculate(achievable_settings)).to eq(true)
      expect(subject.calculate(impossible_settings)).to eq(false)
    end

    context "if the given settings does not indicate a boot device" do
      let(:settings) do
        achievable_settings.tap { |s| s.boot_device = nil }
      end

      it "calculates a new proposal using the first disk as boot device" do
        subject.calculate(settings)

        expect(Y2Storage::StorageManager.instance.proposal.settings).to have_attributes(
          root_device: "/dev/sda"
        )
      end
    end
  end

  describe "#settings" do
    it "returns nil if calculate has not been called yet" do
      expect(proposal.settings).to be_nil
    end

    context "if the proposal was already calculated" do
      before do
        subject.calculate(settings)
      end

      let(:settings) do
        achievable_settings.tap do |settings|
          settings.space.policy = :custom
          settings.space.actions = { "/dev/sda" => :force_delete }
        end
      end

      it "returns the settings used for calculating the proposal" do
        expect(subject.settings).to be_a(Agama::Storage::ProposalSettings)

        expect(subject.settings).to have_attributes(
          boot_device: "/dev/sdb",
          volumes:     contain_exactly(
            an_object_having_attributes(mount_path: "/")
          ),
          # Checking space policy explicitly here because the settings converter cannot infer the
          # space policy from the Y2Storage settings. The space policy is directly recovered from
          # the original settings passed to #calculate.
          space:       an_object_having_attributes(policy: :custom)
        )
      end
    end
  end

  describe "#actions" do
    it "returns an empty list if calculate has not been called yet" do
      expect(subject.actions).to eq([])
    end

    context "if the proposal failed" do
      before do
        subject.calculate(impossible_settings)
      end

      it "returns an empty list" do
        expect(subject.actions).to eq([])
      end
    end

    context "if the proposal was successful" do
      before do
        subject.calculate(achievable_settings)
      end

      it "returns the actions from the actiongraph" do
        expect(proposal.actions).to include(
          an_object_having_attributes(sentence: /Create partition \/dev\/sdb1/)
        )
      end
    end
  end

  describe "#issues" do
    it "returns an empty list if calculate has not been called yet" do
      expect(subject.issues).to eq([])
    end

    it "returns an empty list if the current proposal is successful" do
      subject.calculate(achievable_settings)

      expect(subject.issues).to eq([])
    end

    context "if the current proposal is failed" do
      let(:settings) { impossible_settings }

      it "includes an error because the volumes cannot be accommodated" do
        subject.calculate(settings)

        expect(subject.issues).to include(
          an_object_having_attributes(description: /Cannot accommodate/)
        )
      end

      context "and the settings does not indicate a boot device" do
        before do
          # Avoid to automatically set the first device
          allow(subject).to receive(:available_devices).and_return([])
        end

        let(:settings) { impossible_settings.tap { |s| s.boot_device = nil } }

        it "includes an error because a device is not selected" do
          subject.calculate(settings)

          expect(subject.issues).to include(
            an_object_having_attributes(description: /No device selected/)
          )

          expect(subject.issues).to_not include(
            an_object_having_attributes(description: /device is not found/)
          )
        end
      end

      context "and the boot device is missing in the system" do
        let(:settings) { impossible_settings.tap { |s| s.boot_device = "/dev/vdz" } }

        it "includes an error because the device is not found" do
          subject.calculate(settings)

          expect(subject.issues).to include(
            an_object_having_attributes(description: /device is not found/)
          )
        end
      end
    end
  end
end
