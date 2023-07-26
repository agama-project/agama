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

require_relative "../../test_helper"
require_relative "storage_helpers"
require "agama/storage/proposal"
require "agama/storage/proposal_settings"
require "agama/config"

describe Agama::Storage::Proposal do
  include Agama::RSpec::StorageHelpers
  before { mock_storage(devicegraph: "partitioned_md.yml") }

  subject(:proposal) { described_class.new(config, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config) { Agama::Config.new(config_data) }
  let(:config_data) { {} }

  let(:y2storage_proposal) do
    instance_double(Y2Storage::MinGuidedProposal, propose: true, failed?: false)
  end

  let(:settings) { Agama::Storage::ProposalSettings.new }

  describe "#calculate" do
    before do
      allow(Y2Storage::StorageManager.instance).to receive(:proposal=)

      # This is needed. Not filled by default.
      settings.boot_device = "/dev/sda"
      settings.space.policy = policy
    end

    let(:policy) { :delete }

    it "runs all the callbacks" do
      callback1 = proc {}
      callback2 = proc {}

      proposal.on_calculate(&callback1)
      proposal.on_calculate(&callback2)

      expect(callback1).to receive(:call)
      expect(callback2).to receive(:call)

      proposal.calculate(settings)
    end

    it "stores the given settings" do
      allow(Y2Storage::StorageManager.instance).to receive(:proposal=).and_call_original
      expect(proposal.settings).to be_nil

      proposal.calculate(settings)

      expect(proposal.settings).to_not be_nil
    end

    context "when the Y2Storage proposal succeeds" do
      it "returns true and saves the successful proposal" do
        manager = Y2Storage::StorageManager.instance
        expect(manager).to receive(:proposal=).and_call_original

        expect(proposal.calculate(settings)).to eq true
        expect(manager.proposal.failed?).to eq false
      end
    end

    context "when the Y2Storage proposal fails" do
      before do
        # Enforce an impossible root of 10 TiB
        root = Agama::Storage::Volume.new("/").tap do |vol|
          vol.min_size = Y2Storage::DiskSize.TiB(10)
          vol.fs_type = Y2Storage::Filesystems::Type::BTRFS
        end
        settings.volumes << root
      end

      it "returns false and saves the failed proposal" do
        manager = Y2Storage::StorageManager.instance
        expect(manager).to receive(:proposal=).and_call_original

        expect(proposal.calculate(settings)).to eq false
        expect(manager.proposal.failed?).to eq true
      end
    end

    context "with no encryption settings in the config" do
      it "runs the Y2Storage proposal with default encryption settings" do
        expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
          expect(args[:settings].encryption_method).to eq Y2Storage::EncryptionMethod::LUKS1
          expect(args[:settings].encryption_pbkdf).to be_nil
          y2storage_proposal
        end

        proposal.calculate(settings)
      end
    end

    context "with encryption settings in the config" do
      before do
        settings.encryption.method = Y2Storage::EncryptionMethod::LUKS2
        settings.encryption.pbkd_function = Y2Storage::PbkdFunction::PBKDF2
      end

      it "runs the Y2Storage proposal with default encryption settings" do
        expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
          expect(args[:settings].encryption_method).to eq Y2Storage::EncryptionMethod::LUKS2
          expect(args[:settings].encryption_pbkdf).to eq Y2Storage::PbkdFunction::PBKDF2
          y2storage_proposal
        end

        proposal.calculate(settings)
      end
    end

    def expect_space_actions(actions)
      expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
        expect(args[:settings]).to be_a(Y2Storage::ProposalSettings)
        space = args[:settings].space_settings
        expect(space.strategy).to eq :bigger_resize
        expect(space.actions).to eq actions

        y2storage_proposal
      end
    end

    context "when preserving existing partitions" do
      let(:policy) { :keep }

      it "runs the Y2Storage proposal with an empty list of actions for :bigger_resize" do
        expect_space_actions({})
        proposal.calculate(settings)
      end
    end

    context "when deleting existing partitions" do
      let(:policy) { :delete }

      it "runs the Y2Storage proposal with delete actions for every partition" do
        expect_space_actions({ "/dev/sda1" => :force_delete, "/dev/sda2" => :force_delete })
        proposal.calculate(settings)
      end
    end

    context "when deleting existing partitions" do
      let(:policy) { :resize }

      it "runs the Y2Storage proposal with resize actions for every partition" do
        expect_space_actions({ "/dev/sda1" => :resize, "/dev/sda2" => :resize })
        proposal.calculate(settings)
      end
    end
  end

  describe "#actions" do
    before do
      allow(subject).to receive(:proposal).and_return(y2storage_proposal)
    end

    context "when there is no proposal" do
      let(:y2storage_proposal) { nil }

      it "returns an empty list" do
        expect(subject.actions).to eq([])
      end
    end

    context "when there is a proposal" do
      let(:y2storage_proposal) { instance_double(Y2Storage::MinGuidedProposal, devices: devices) }

      context "and the proposal failed" do
        let(:devices) { nil }

        it "returns an empty list" do
          expect(subject.actions).to eq([])
        end
      end

      context "and the proposal was successful" do
        let(:devices) { instance_double(Y2Storage::Devicegraph, actiongraph: actiongraph) }
        let(:actiongraph) { instance_double(Y2Storage::Actiongraph, compound_actions: actions) }

        let(:actions) { [fs_action, subvol_action] }
        let(:fs_action) { instance_double(Y2Storage::CompoundAction, delete?: false) }
        let(:subvol_action) { instance_double(Y2Storage::CompoundAction, delete?: false) }

        before do
          allow(fs_action).to receive(:device_is?).with(:btrfs_subvolume).and_return false
          allow(subvol_action).to receive(:device_is?).with(:btrfs_subvolume).and_return true
        end

        it "returns the actions from the actiongraph" do
          expect(proposal.actions).to contain_exactly(fs_action, subvol_action)
        end
      end
    end
  end

  describe "#settings" do
    context "if #calculate has not been called yet" do
      it "returns nil" do
        expect(proposal.settings).to be_nil
      end
    end

    context "if #calculate was called" do
      before do
        volume = Agama::Storage::Volume.new("/something").tap do |vol|
          vol.min_size = Y2Storage::DiskSize.GiB(10)
          vol.max_size = Y2Storage::DiskSize.unlimited
          vol.fs_type = Y2Storage::Filesystems::Type::EXT2
        end
        settings.volumes << volume
        proposal.calculate(settings)
      end

      it "returns the settings from the #calculate call" do
        expect(proposal.settings.volumes.map(&:mount_path)).to include("/something")
      end
    end
  end

  describe "#issues" do
    context "when the proposal does not exist yet" do
      it "returns an empty list" do
        expect(subject.issues).to eq([])
      end
    end

    context "when there was already a proposal attempt" do
      before do
        settings.boot_device = boot_device
        proposal.calculate(settings)
      end

      let(:sda) { instance_double(Y2Storage::Disk, name: "/dev/sda") }
      let(:boot_device) { nil }

      context "but no boot device was selected" do
        let(:boot_device) { nil }

        it "returns a list of errors including the expected error" do
          expect(subject.issues).to include(
            an_object_having_attributes(description: /No device selected/)
          )
        end
      end

      context "but the boot device is missing" do
        let(:boot_device) { "/dev/vda" }

        it "returns a list of errors including the expected error" do
          expect(subject.issues).to include(
            an_object_having_attributes(description: /device is not found/)
          )
        end
      end
    end

    context "when there was a failed proposal attempt" do
      before do
        # Enforce an impossible root of 10 TiB
        root = Agama::Storage::Volume.new("/").tap do |vol|
          vol.min_size = Y2Storage::DiskSize.TiB(10)
          vol.fs_type = Y2Storage::Filesystems::Type::BTRFS
        end
        settings.volumes << root
        settings.boot_device = "/dev/sda"
        proposal.calculate(settings)
      end

      it "returns a list of errors including the expected error" do
        expect(subject.issues).to include(
          an_object_having_attributes(description: /Cannot accommodate/)
        )
      end
    end
  end
end
