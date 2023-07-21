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

describe "Y2Storage conversions at Agama::Storage::Proposal" do
  include Agama::RSpec::StorageHelpers
  before { mock_storage(devicegraph: scenario) }
  let(:scenario) { "partitioned_md.yml" }

  subject(:proposal) { Agama::Storage::Proposal.new(config, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config) { Agama::Config.new(config_data) }
  let(:config_data) { {} }

  let(:y2storage_proposal) do
    instance_double(Y2Storage::MinGuidedProposal, propose: true, failed?: false)
  end

  let(:settings) { Agama::Storage::ProposalSettings.new }

  def expect_space_actions(actions)
    expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
      expect(args[:settings]).to be_a(Y2Storage::ProposalSettings)
      space = args[:settings].space_settings
      expect(space.strategy).to eq :bigger_resize
      expect(space.actions).to eq actions

      y2storage_proposal
    end
  end

  describe "#calculate" do
    before do
      allow(Y2Storage::StorageManager.instance).to receive(:proposal=)

      # This is needed. Not filled by default.
      settings.boot_device = "/dev/sda"
      settings.space.policy = policy
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
end
