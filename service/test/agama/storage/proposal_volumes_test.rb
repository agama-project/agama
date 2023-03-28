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

describe DInstaller::Storage::Proposal do
  include DInstaller::RSpec::StorageHelpers
  before do
    mock_storage
    allow(Y2Storage::StorageManager.instance).to receive(:proposal=)
  end

  subject(:proposal) { described_class.new(logger, config) }

  let(:logger) { Logger.new($stdout, level: :warn) }
  let(:config) { DInstaller::Config.new(config_data) }

  let(:config_data) do
    { "storage" => { "volumes" => config_volumes } }
  end
  let(:settings) do
    settings = DInstaller::Storage::ProposalSettings.new
    settings.volumes = volumes
    settings
  end

  let(:config_volumes) do
    [
      {
        "mount_point" => "/", "fs_type" => "btrfs", "fs_types" => ["btrfs", "ext4"],
        "snapshots" => true, "snapshots_configurable" => true,
        "min_size" => "10 GiB", "snapshots_percentage" => "300"
      },
      {
        "mount_point" => "/two", "fs_type" => "xfs", "fs_types" => ["xfs", "ext4"],
        "min_size" => "5 GiB", "proposed_configurable" => true, "fallback_for_min_size" => "/"
      }
    ]
  end

  let(:y2storage_proposal) do
    instance_double(Y2Storage::MinGuidedProposal, propose: true, failed?: false)
  end

  # Constructs a DInstaller volume with the given set of attributes
  #
  # @param attrs [Hash] set of attributes and their values (sizes can be provided as strings)
  # @return [DInstaller::Storage::Volume]
  def test_vol(attrs = {})
    vol = DInstaller::Storage::Volume.new
    attrs.each do |attr, value|
      if [:min_size, :max_size].include?(attr.to_sym)
        # DiskSize.new can take a DiskSize, a string or a number
        value = Y2Storage::DiskSize.new(value)
      end
      vol.public_send(:"#{attr}=", value)
    end
    vol
  end

  # Returns the correct Y2Storage::Filesystem type object for the given filesystem type
  #
  # @param type [String, Symbol, Y2Storage::Filesystems::Type]
  # @return [Y2Storage::Filesystems::Type]
  def fs_type(type)
    return type if type.is_a?(Y2Storage::Filesystems::Type)

    Y2Storage::Filesystems::Type.find(type.downcase.to_sym)
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

  # Ideas for more tests:
  #  - Passing a fs_type not included in fs_types (even trying to redefine fs_types)
  #  - Trying to hack "optional" to disable a mandatory volume

  context "when the settings customize volumes from the config" do
    let(:volumes) do
      [
        test_vol(
          mount_point: "/", fixed_size_limits: true, min_size: "7 GiB", max_size: "9 GiB",
          # Attributes that cannot be (re)defined here
          encrypted: true, device_type: :lvm_lv
        ),
        test_vol(
          mount_point: "/two", max_size: "unlimited", fs_type: fs_type(:ext4),
          # Attributes that cannot be (re)defined here
          fixed_size_limits: false, snapshots: true
        )
      ]
    end

    describe "#calculate" do
      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_expects(
          {
            mount_point: "/", proposed: true, fs_type: fs_type(:btrfs), snapshots: true,
            ignore_fallback_sizes: true, ignore_snapshots_sizes: true,
            min_size: Y2Storage::DiskSize.GiB(7), max_size: Y2Storage::DiskSize.GiB(9)
          },
          {
            mount_point: "/two", proposed: true, fs_type: fs_type(:ext4), snapshots: false,
            min_size: Y2Storage::DiskSize.GiB(5), max_size: Y2Storage::DiskSize.unlimited
          }
        )

        proposal.calculate(settings)
      end
    end

    describe "#calculated_settings" do
      it "returns settings with the correct set of volumes" do
        proposal.calculate(settings)

        expect(proposal.calculated_settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", optional: false, encrypted: false, device_type: :partition,
            fs_type: fs_type(:btrfs), fs_types: [fs_type(:btrfs), fs_type(:ext4)],
            snapshots: true, fixed_size_limits: true, size_relevant_volumes: ["/two"],
            min_size: Y2Storage::DiskSize.GiB(7), max_size: Y2Storage::DiskSize.GiB(9)
          ),
          an_object_having_attributes(
            mount_point: "/two", optional: true, encrypted: false, device_type: :partition,
            fs_type: fs_type(:ext4), fs_types: [fs_type(:xfs), fs_type(:ext4)],
            snapshots: false, fixed_size_limits: true, size_relevant_volumes: [],
            min_size: Y2Storage::DiskSize.GiB(5), max_size: Y2Storage::DiskSize.unlimited
          )
        )
      end
    end
  end

  context "if the settings redefine mandatory volumes and omit the optional" do
    let(:volumes) { [test_vol(mount_point: "/", snapshots: false)] }

    describe "#calculate" do
      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_expects(
          { mount_point: "/", proposed: true, snapshots: false },
          { mount_point: "/two", proposed: false }
        )
        proposal.calculate(settings)
      end
    end

    describe "#calculated_settings" do
      it "returns settings with the correct set of mandatory volumes" do
        proposal.calculate(settings)

        expect(proposal.calculated_settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", optional: false, snapshots: false,
            fs_type: fs_type(:btrfs), fs_types: [fs_type(:btrfs), fs_type(:ext4)],
            fixed_size_limits: false, size_relevant_volumes: ["/two"],
            min_size: Y2Storage::DiskSize.GiB(15), max_size: Y2Storage::DiskSize.unlimited
          )
        )
      end
    end
  end

  context "if the settings omit the mandatory volumes and add some others" do
    let(:volumes) { [test_vol(mount_point: "/var", min_size: "5 GiB")] }

    describe "#calculate" do
      it "runs the Y2Storage proposal with the correct set of VolumeSpecification" do
        expect_proposal_with_expects(
          { mount_point: "/", proposed: true, snapshots: true },
          { mount_point: "/two", proposed: false },
          { mount_point: "/var", proposed: true, max_size: Y2Storage::DiskSize.unlimited }
        )
        proposal.calculate(settings)
      end
    end

    describe "#calculated_settings" do
      it "returns settings with the correct set of volumes" do
        proposal.calculate(settings)

        expect(proposal.calculated_settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", optional: false, snapshots: true,
            fs_type: fs_type(:btrfs), fs_types: [fs_type(:btrfs), fs_type(:ext4)]
          ),
          an_object_having_attributes(mount_point: "/var", optional: true)
        )
      end
    end
  end

  context "when dynamic sizes are used and they are affected by other volumes" do
    let(:volumes) { [test_vol(mount_point: "/", snapshots: false, min_size: "4 GiB")] }

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

    describe "#calculated_settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.calculated_settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", snapshots: false, fixed_size_limits: false,
            size_relevant_volumes: ["/two"], min_size: Y2Storage::DiskSize.GiB(15)
          )
        )
      end
    end
  end

  context "when dynamic sizes are used and they are affected by snapshots" do
    let(:volumes) { [test_vol(mount_point: "/"), test_vol(mount_point: "/two")] }

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

    describe "#calculated_settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.calculated_settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", snapshots: true, fixed_size_limits: false,
            min_size: Y2Storage::DiskSize.GiB(40)
          ),
          an_object_having_attributes(mount_point: "/two")
        )
      end
    end
  end

  context "when dynamic sizes are used and they are affected by snapshots and other volumes" do
    let(:volumes) { [test_vol(mount_point: "/", min_size: "6 GiB")] }

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

    describe "#calculated_settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.calculated_settings.volumes).to contain_exactly(
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
      [test_vol(mount_point: "/", fixed_size_limits: true, min_size: "6 GiB")]
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

    describe "#calculated_settings" do
      it "returns settings with a set of volumes with fixed limits and adjusted sizes" do
        proposal.calculate(settings)

        expect(proposal.calculated_settings.volumes).to contain_exactly(
          an_object_having_attributes(
            mount_point: "/", snapshots: true, fixed_size_limits: true,
            size_relevant_volumes: ["/two"], min_size: Y2Storage::DiskSize.GiB(6)
          )
        )
      end
    end
  end
end
