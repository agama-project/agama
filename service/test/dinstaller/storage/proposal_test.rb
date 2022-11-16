# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "dinstaller/storage/proposal"
require "dinstaller/config"

describe DInstaller::Storage::Proposal do
  include DInstaller::RSpec::StorageHelpers
  before { mock_storage }

  subject(:proposal) { described_class.new(logger, config) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config) { DInstaller::Config.new(config_data) }
  let(:config_data) do
    { "storage" => { "volumes" => config_volumes } }
  end

  let(:config_volumes) do
    [
      {
        "mount_point" => "/", "fs_type" => "btrfs", "min_size" => "10 GiB",
        "snapshots" => true, "snapshots_percentage" => "300"
      },
      {
        "mount_point" => "/two", "fs_type" => "xfs", "min_size" => "5 GiB",
        "proposed_configurable" => true, "fallback_for_min_size" => "/"
      }
    ]
  end

  let(:y2storage_proposal) do
    instance_double(Y2Storage::MinGuidedProposal, propose: true, failed?: failed)
  end
  let(:failed) { false }

  describe "#calculate" do

    before { allow(Y2Storage::StorageManager.instance).to receive(:proposal=) }

    RSpec.shared_examples "y2storage proposal with no candidates" do
      it "runs the Y2Storage proposal with no candidate devices" do
        expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
          expect(args[:settings].candidate_devices).to be_nil
          y2storage_proposal
        end

        proposal.calculate
      end
    end

    RSpec.shared_examples "y2storage proposal from config" do
      it "runs the Y2Storage proposal with a set of VolumeSpecification based on the config" do
        expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
          vols = args[:settings].volumes
          expect(vols).to all(be_a(Y2Storage::VolumeSpecification))
          expect(vols.map(&:mount_point)).to contain_exactly("/", "/two")

          y2storage_proposal
        end

        proposal.calculate
      end

      include_examples "y2storage proposal with no candidates"
    end

    it "runs all the callbacks" do
      var1 = 5
      var2 = 5
      proposal.on_calculate do
        var1 += 1
      end
      proposal.on_calculate { var2 *= 2 }

      expect(var1).to eq 5
      expect(var2).to eq 5
      proposal.calculate
      expect(var1).to eq 6
      expect(var2).to eq 10
    end

    context "with undefined settings and no storage section in the config" do
      let(:config_data) { {} }

      it "runs the Y2Storage proposal with a default set of VolumeSpecification" do
        expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
          expect(args[:settings]).to be_a(Y2Storage::ProposalSettings)
          vols = args[:settings].volumes
          expect(vols).to_not be_empty
          expect(vols).to all(be_a(Y2Storage::VolumeSpecification))

          y2storage_proposal
        end

        proposal.calculate
      end

      include_examples "y2storage proposal with no candidates"
    end

    context "with undefined settings" do
      include_examples "y2storage proposal from config"
    end

    context "with the default settings" do
      let(:settings) { DInstaller::Storage::ProposalSettings.new }

      include_examples "y2storage proposal from config"
    end

    context "with settings defining a list of candidate devices" do
      let(:settings) do
        settings = DInstaller::Storage::ProposalSettings.new
        settings.candidate_devices = devices
        settings
      end

      context "if the defined list is empty" do
        let(:devices) { [] }

        include_examples "y2storage proposal with no candidates"
      end

      context "if the defined list contains valid device names" do
        let(:devices) { ["/dev/sda"] }

        it "runs the Y2Storage proposal with the specified candidate devices" do
          expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
            expect(args[:settings].candidate_devices).to eq devices
            y2storage_proposal
          end

          proposal.calculate(settings)
        end
      end
    end

    context "when the Y2Storage proposal succeeds" do
      it "returns true and saves the successful proposal" do
        manager = Y2Storage::StorageManager.instance
        expect(manager).to receive(:proposal=).and_call_original

        expect(proposal.calculate).to eq true
        expect(manager.proposal.failed?).to eq false
      end
    end

    context "when the Y2Storage proposal fails" do
      let(:config_volumes) do
        # Enforce an impossible root of 10 TiB
        [{ "mount_point" => "/", "fs_type" => "btrfs", "min_size" => "10 TiB" }]
      end

      it "returns false and saves the failed proposal" do
        manager = Y2Storage::StorageManager.instance
        expect(manager).to receive(:proposal=).and_call_original

        expect(proposal.calculate).to eq false
        expect(manager.proposal.failed?).to eq true
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

  describe "#volume_templates" do
    it "returns a list with the default volumes from the configuration" do
      templates = proposal.volume_templates
      expect(templates).to all be_a(DInstaller::Storage::Volume)
      expect(templates.map(&:mount_point)).to contain_exactly("/", "/two")
    end

    context "with no storage section in the configuration" do
      let(:config_data) { {} }

      it "returns settings with a fallback list of volumes" do
        templates = proposal.volume_templates
        expect(templates).to_not be_empty
        expect(templates).to all be_a(DInstaller::Storage::Volume)
      end
    end

    context "with volumes that are disabled by default" do
      let(:config_volumes) do
        [
          { "mount_point" => "/", "fs_type" => "btrfs", "min_size" => "10 GiB" },
          { "mount_point" => "/enabled", "min_size" => "5 GiB" },
          { "mount_point" => "/disabled", "proposed" => false, "min_size" => "5 GiB" }
        ]
      end

      it "returns a set including enabled and disabled volumes" do
        expect(proposal.volume_templates.map(&:mount_point)).to contain_exactly(
          "/", "/enabled", "/disabled"
        )
      end
    end
  end

  describe "#calculated_settings" do
    context "if #calculate has not been called yet" do
      it "returns nil" do
        expect(proposal.calculated_settings).to be_nil
      end
    end

    context "if #calculate was called without settings" do
      before do
        proposal.calculate
      end

      context "and the config has disabled volumes" do
        let(:config_volumes) do
          [
            { "mount_point" => "/", "fs_type" => "btrfs", "min_size" => "10 GiB" },
            { "mount_point" => "/enabled", "min_size" => "5 GiB" },
            { "mount_point" => "/disabled", "proposed" => false, "min_size" => "5 GiB" }
          ]
        end

        # Note that calling #calculate without settings means "reset to default"
        it "returns settings with only the volumes enabled by default" do
          expect(proposal.calculated_settings.volumes.map(&:mount_point))
            .to contain_exactly("/", "/enabled")
        end
      end
    end
  end

  describe "#validate" do
    let(:sda) { instance_double(Y2Storage::Device, display_name: "/dev/sda") }
    let(:available_devices) { [sda] }
    let(:candidate_devices) { ["/dev/sda"] }

    before do
      allow(subject).to receive(:available_devices).and_return(available_devices)
      allow(subject).to receive(:candidate_devices).and_return(candidate_devices)
      allow(subject).to receive(:proposal).and_return(y2storage_proposal)
    end

    context "when the proposal was successful" do
      let(:failed) { false }

      it "returns an empty list" do
        expect(subject.validate).to eq([])
      end
    end

    context "when the proposal does not exist yet" do
      let(:y2storage_proposal) { nil }

      it "returns an empty list" do
        expect(subject.validate).to be_empty
      end
    end

    context "when there are not available storage devices" do
      let(:available_devices) { [] }

      it "returns an error" do
        errors = subject.validate
        expect(errors.size).to eq(1)
        expect(errors.first.message).to include("not find a suitable device")
      end
    end

    context "when the proposal failed" do
      let(:failed) { true }

      it "returns an error" do
        errors = subject.validate
        expect(errors.size).to eq(1)
        expect(errors.first.message).to include("not create a storage proposal using /dev/sda")
      end
    end

    context "when no candidate devices are selected" do
      let(:candidate_devices) { [] }

      it "returns an error" do
        errors = subject.validate
        expect(errors.size).to eq(1)
        expect(errors.first.message).to include("No devices are selected for installation")
      end
    end
  end
end
