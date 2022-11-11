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

  describe "#calculate" do
    let(:y2storage_proposal) do
      instance_double(Y2Storage::MinGuidedProposal, propose: true, failed?: false)
    end

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
    let(:y2storage_manager) { instance_double(Y2Storage::StorageManager, staging: staging) }
    let(:staging) { instance_double(Y2Storage::Devicegraph, actiongraph: actiongraph) }
    let(:actiongraph) do
      instance_double(Y2Storage::Actiongraph, compound_actions: y2storage_actions)
    end

    before { allow(Y2Storage::StorageManager).to receive(:instance).and_return(y2storage_manager) }

    context "with an empty actiongraph" do
      let(:y2storage_actions) { [] }

      it "returns an empty set of actions" do
        expect(proposal.actions).to be_a DInstaller::Storage::Actions
        expect(proposal.actions.all).to eq []
      end
    end

    context "with an non-empty actiongraph" do
      let(:y2storage_actions) { [fs_action, subvol_action] }
      let(:fs_action) { instance_double(Y2Storage::CompoundAction, delete?: false) }
      let(:subvol_action) { instance_double(Y2Storage::CompoundAction, delete?: false) }

      before do
        allow(fs_action).to receive(:device_is?).with(:btrfs_subvolume).and_return false
        allow(subvol_action).to receive(:device_is?).with(:btrfs_subvolume).and_return true
      end

      it "returns the set of actions from the actiongraph" do
        expect(proposal.actions).to be_a DInstaller::Storage::Actions
        expect(proposal.actions.all).to contain_exactly(fs_action, subvol_action)
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

  describe "#calculated_volumes" do
    it "returns an empty array if #calculate has not being called" do
      expect(proposal.calculated_volumes).to eq []
    end

    context "with volumes that are disabled by default" do
      let(:config_volumes) do
        [
          { "mount_point" => "/", "fs_type" => "btrfs", "min_size" => "10 GiB" },
          { "mount_point" => "/enabled", "min_size" => "5 GiB" },
          { "mount_point" => "/disabled", "proposed" => false, "min_size" => "5 GiB" }
        ]
      end

      # Note that calling #calculate without settings means "reset to default volumes"
      it "returns only the volumes enabled by default if #calculate was called with no settings" do
        proposal.calculate
        expect(proposal.calculated_volumes.map(&:mount_point)).to contain_exactly("/", "/enabled")
      end
    end
  end

  describe "#settings" do
    let(:settings) { DInstaller::Storage::ProposalSettings.new }

    it "returns nil if #calculate has not being called" do
      expect(proposal.settings).to be_nil
    end

    it "returns the settings previously passed to #calculate" do
      proposal.calculate(settings)
      expect(proposal.settings).to eq settings
    end
  end
end
