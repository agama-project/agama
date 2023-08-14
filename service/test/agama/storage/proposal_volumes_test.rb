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
require "agama/storage/proposal"
require "agama/config"

describe Agama::Storage::Proposal do
  include Agama::RSpec::StorageHelpers
  before { mock_storage }

  subject(:proposal) { described_class.new(config, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    { "storage" => { "volumes" => cfg_volumes, "volume_templates" => cfg_templates } }
  end

  let(:cfg_volumes) { ["/", "swap"] }

  let(:cfg_templates) { [root_template, other_template] }
  let(:root_template) do
    {
      "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
      "outline" => {
        "snapshots_configurable" => true,
        "auto_size"              => {
          "base_min" => "10 GiB", "base_max" => "20 GiB",
          "min_fallback_for" => ["/home"], "snapshots_increment" => "300%"
        }
      }
    }
  end
  let(:other_template) do
    {
      "mount_path" => "/two", "filesystem" => "xfs",
      "size" => { "auto" => false, "min" => "5 GiB" }
    }
  end

  let(:settings) do
    settings = Agama::Storage::ProposalSettings.new
    settings.volumes = volumes
    settings
  end

  let(:y2storage_proposal) do
    instance_double(Y2Storage::MinGuidedProposal, propose: true, failed?: false)
  end

  let(:vol_builder) { Agama::Storage::VolumeTemplatesBuilder.new_from_config(config) }

  # Constructs a Agama volume with the given set of attributes
  #
  # @param attrs [Hash] set of attributes and their values (sizes can be provided as strings)
  # @return [Agama::Storage::Volume]
  def test_vol(path, attrs = {})
    vol = vol_builder.for(path)
    attrs.each do |attr, value|
      if [:min_size, :max_size].include?(attr.to_sym)
        # DiskSize.new can take a DiskSize, a string or a number
        value = Y2Storage::DiskSize.new(value)
      end
      if attr.to_sym == :snapshots
        vol.btrfs.snapshots = value
      else
        vol.public_send(:"#{attr}=", value)
      end
    end
    vol
  end

  # Sets the expectation for a Y2Storage::MinGuidedProposal to be created with the
  # given set of Y2Storage::VolumeSpecification objects and returns proposal mocked as
  # 'y2storage_proposal'
  #
  # @param specs [Hash] arguments to check on each VolumeSpecification object
  def expect_proposal_with_expects(*specs)
    expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
      expect(args[:settings]).to be_a(Y2Storage::ProposalSettings)
      expect(args[:settings].volumes).to all(be_a(Y2Storage::VolumeSpecification))
      expect(args[:settings].volumes).to contain_exactly(
        *specs.map { |spec| an_object_having_attributes(spec) }
      )

      y2storage_proposal
    end
  end

  context "when dynamic sizes are used and they are affected by other volumes" do
    let(:volumes) { [test_vol("/", snapshots: false, auto_size: true, min_size: "4 GiB")] }

    describe "#calculate" do
      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_expects(
          {
            mount_point: "/", proposed: true, snapshots: false,
            ignore_fallback_sizes: false, ignore_snapshots_sizes: false,
            min_size: Y2Storage::DiskSize.GiB(10)
          },
          { mount_point: "/two", proposed: false, fallback_for_min_size: "/" }
        )
        proposal.calculate(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", snapshots: false, auto_size: true,
            min_size: Y2Storage::DiskSize.GiB(15)
          )
        )
      end
    end
  end

  context "when dynamic sizes are used and they are affected by snapshots" do
    let(:volumes) { [test_vol("/", snapshots: true), test_vol("/two")] }

    describe "#calculate" do
      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_expects(
          {
            mount_point: "/", proposed: true, snapshots: true,
            ignore_fallback_sizes: false, ignore_snapshots_sizes: false,
            min_size: Y2Storage::DiskSize.GiB(10)
          },
          { mount_point: "/two", proposed: true, fallback_for_min_size: "/" }
        )
        proposal.calculate(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", snapshots: true, auto_size: true,
            min_size: Y2Storage::DiskSize.GiB(40)
          ),
          an_object_having_attributes(mount_point: "/two")
        )
      end
    end
  end

  context "when dynamic sizes are used and they are affected by snapshots and other volumes" do
    let(:volumes) { [test_vol("/", auto_size: true, min_size: "6 GiB")] }

    describe "#calculate" do
      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_expects(
          {
            mount_point: "/", proposed: true, snapshots: true,
            ignore_fallback_sizes: false, ignore_snapshots_sizes: false,
            min_size: Y2Storage::DiskSize.GiB(10)
          },
          { mount_point: "/two", proposed: false, fallback_for_min_size: "/" }
        )
        proposal.calculate(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", snapshots: true, fixed_size_limits: false,
            size_relevant_volumes: ["/two"], min_size: Y2Storage::DiskSize.GiB(60)
          )
        )
      end
    end
  end

  context "when fixed sizes are enforced" do
    let(:volumes) do
      [test_vol("/", auto_size: false, min_size: "6 GiB")]
    end

    describe "#calculate" do
      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_expects(
          {
            mount_point: "/", proposed: true, snapshots: true,
            ignore_fallback_sizes: true, ignore_snapshots_sizes: true,
            min_size: Y2Storage::DiskSize.GiB(6)
          },
          { mount_point: "/two", proposed: false, fallback_for_min_size: "/" }
        )
        proposal.calculate(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", snapshots: true, fixed_size_limits: true,
            size_relevant_volumes: ["/two"], min_size: Y2Storage::DiskSize.GiB(6)
          )
        )
      end
    end
  end
end
