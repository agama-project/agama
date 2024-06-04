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
require "agama/storage/volume_templates_builder"
require "agama/config"
require "y2storage"

describe Agama::Storage::Proposal do
  include Agama::RSpec::StorageHelpers
  before do
    allow(Yast::SCR).to receive(:Read).and_call_original
    allow(Yast::SCR).to receive(:Read).with(path(".proc.meminfo"))
      .and_return("memtotal" => 8388608)

    mock_storage
  end

  subject(:proposal) { described_class.new(config, logger: logger) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config) { Agama::Config.new(config_data) }

  let(:config_data) do
    { "storage" => { "volumes" => cfg_volumes, "volume_templates" => cfg_templates } }
  end

  let(:cfg_volumes) { ["/", "swap"] }

  let(:cfg_templates) { [root_template, swap_template, other_template] }
  let(:root_template) do
    {
      "mount_path" => "/", "filesystem" => "btrfs", "size" => { "auto" => true },
      "outline" => {
        "snapshots_configurable" => true,
        "auto_size"              => {
          "base_min" => "10 GiB", "base_max" => "20 GiB",
          "min_fallback_for" => ["/two"], "snapshots_increment" => "300%"
        }
      }
    }
  end
  let(:swap_template) do
    {
      "mount_path" => "swap", "filesystem" => "swap", "size" => { "auto" => true },
      "outline" => {
        "auto_size" => { "base_min" => "1 GiB", "base_max" => "2 GiB", "adjust_by_ram" => true }
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
    instance_double(Y2Storage::MinGuidedProposal,
      propose: true, failed?: false, settings: y2storage_settings, planned_devices: [])
  end

  let(:vol_builder) { Agama::Storage::VolumeTemplatesBuilder.new_from_config(config) }

  let(:y2storage_settings) { Y2Storage::ProposalSettings.new }

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
  def expect_proposal_with_specs(*specs)
    expect(Y2Storage::MinGuidedProposal).to receive(:new) do |**args|
      expect(args[:settings]).to be_a(Y2Storage::ProposalSettings)
      expect(args[:settings].volumes).to all(be_a(Y2Storage::VolumeSpecification))
      expect(args[:settings].volumes).to contain_exactly(
        *specs.map { |spec| an_object_having_attributes(spec) }
      )

      y2storage_proposal
    end
  end

  context "when auto size is used and the size is affected by other volumes" do
    let(:volumes) { [test_vol("/", snapshots: false, auto_size: true, min_size: "4 GiB")] }

    describe "#calculate" do
      before do
        allow(Y2Storage::StorageManager.instance)
          .to receive(:proposal).and_return(y2storage_proposal)

        allow(Y2Storage::StorageManager.instance).to receive(:proposal=)
      end

      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_specs(
          {
            mount_point: "/", proposed: true, snapshots: false,
            ignore_fallback_sizes: false, ignore_snapshots_sizes: false,
            min_size: Y2Storage::DiskSize.GiB(10)
          },
          { mount_point: "swap", proposed: false },
          { mount_point: "/two", proposed: false, fallback_for_min_size: "/" }
        )
        proposal.calculate_guided(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with adjusted sizes" do
        proposal.calculate_guided(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_path: "/",
            auto_size:  true,
            min_size:   Y2Storage::DiskSize.GiB(15),
            btrfs:      an_object_having_attributes(snapshots?: false)
          )
        )
      end
    end
  end

  context "when auto size is used and it is affected by snapshots" do
    let(:volumes) { [test_vol("/", snapshots: true), test_vol("/two")] }

    describe "#calculate" do
      before do
        allow(Y2Storage::StorageManager.instance)
          .to receive(:proposal).and_return(y2storage_proposal)

        allow(Y2Storage::StorageManager.instance).to receive(:proposal=)
      end

      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_specs(
          {
            mount_point: "/", proposed: true, snapshots: true,
            ignore_fallback_sizes: false, ignore_snapshots_sizes: false,
            min_size: Y2Storage::DiskSize.GiB(10)
          },
          { mount_point: "swap", proposed: false },
          { mount_point: "/two", proposed: true, fallback_for_min_size: "/" }
        )
        proposal.calculate_guided(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with adjusted sizes" do
        proposal.calculate_guided(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_path: "/",
            auto_size:  true,
            min_size:   Y2Storage::DiskSize.GiB(40),
            btrfs:      an_object_having_attributes(snapshots?: true)
          ),
          an_object_having_attributes(mount_path: "/two")
        )
      end
    end
  end

  context "when auto size is used and it is affected by snapshots and other volumes" do
    let(:volumes) { [test_vol("/", auto_size: true, snapshots: true, min_size: "6 GiB")] }

    describe "#calculate" do
      before do
        allow(Y2Storage::StorageManager.instance)
          .to receive(:proposal).and_return(y2storage_proposal)

        allow(Y2Storage::StorageManager.instance).to receive(:proposal=)
      end

      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_specs(
          {
            mount_point: "/", proposed: true, snapshots: true,
            ignore_fallback_sizes: false, ignore_snapshots_sizes: false,
            min_size: Y2Storage::DiskSize.GiB(10)
          },
          { mount_point: "swap", proposed: false },
          { mount_point: "/two", proposed: false, fallback_for_min_size: "/" }
        )
        proposal.calculate_guided(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate_guided(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_path: "/",
            btrfs:      an_object_having_attributes(snapshots?: true),
            auto_size?: true,
            min_size:   Y2Storage::DiskSize.GiB(60),
            outline:    an_object_having_attributes(min_size_fallback_for: ["/two"])
          )
        )
      end
    end
  end

  context "when auto size is used and it is affected by RAM size" do
    let(:volumes) { [test_vol("/"), test_vol("swap")] }

    describe "#calculate" do
      before do
        allow(Y2Storage::StorageManager.instance)
          .to receive(:proposal).and_return(y2storage_proposal)

        allow(Y2Storage::StorageManager.instance).to receive(:proposal=)
      end

      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_specs(
          { mount_point: "/", proposed: true },
          { mount_point: "/two", proposed: false },
          {
            mount_point: "swap", proposed: true, ignore_adjust_by_ram: false,
            min_size: Y2Storage::DiskSize.GiB(1)
          }
        )
        proposal.calculate_guided(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with adjusted sizes" do
        proposal.calculate_guided(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(mount_path: "/", auto_size: true),
          an_object_having_attributes(
            mount_path: "swap",
            auto_size?: true,
            min_size:   Y2Storage::DiskSize.GiB(8)
          )
        )
      end
    end
  end

  context "when fixed sizes are enforced" do
    let(:volumes) do
      [
        test_vol("/", auto_size: false, min_size: "6 GiB"),
        test_vol("swap", auto_size: false, min_size: "1 GiB")
      ]
    end

    describe "#calculate" do
      before do
        allow(Y2Storage::StorageManager.instance)
          .to receive(:proposal).and_return(y2storage_proposal)

        allow(Y2Storage::StorageManager.instance).to receive(:proposal=)
      end

      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_specs(
          {
            mount_point: "/", proposed: true, snapshots: false,
            ignore_fallback_sizes: true, ignore_snapshots_sizes: true,
            min_size: Y2Storage::DiskSize.GiB(6)
          },
          {
            mount_point: "swap", proposed: true, ignore_adjust_by_ram: true,
            min_size: Y2Storage::DiskSize.GiB(1)
          },
          { mount_point: "/two", proposed: false, fallback_for_min_size: "/" }
        )
        proposal.calculate_guided(settings)
      end
    end

    describe "#settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate_guided(settings)

        expect(proposal.settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_path: "/",
            btrfs:      an_object_having_attributes(snapshots?: false),
            auto_size?: false,
            min_size:   Y2Storage::DiskSize.GiB(6),
            outline:    an_object_having_attributes(min_size_fallback_for: ["/two"])
          ),
          an_object_having_attributes(
            mount_path: "swap",
            auto_size?: false,
            min_size:   Y2Storage::DiskSize.GiB(1),
            outline:    an_object_having_attributes(adjust_by_ram: true)
          )
        )
      end
    end
  end
end
