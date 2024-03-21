# frozen_string_literal: true

# Copyright (c) [2023] SUSE LLC
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
require_relative "../storage_helpers"
require_relative "../../rspec/matchers/storage"
require "agama/storage/volume_conversion/from_y2storage"
require "agama/config"
require "y2storage"

describe Agama::Storage::VolumeConversion::FromY2Storage do
  include Agama::RSpec::StorageHelpers

  before { mock_storage }

  subject { described_class.new(spec, config: config) }

  let(:config) { Agama::Config.new }

  describe "#convert" do
    let(:spec) do
      Y2Storage::VolumeSpecification.new({}).tap do |spec|
        spec.mount_point = "/"
        spec.device = "/dev/sda"
        spec.separate_vg_name = "/dev/vg0"
        spec.mount_options = ["defaults", "ro"]
        spec.fs_type = Y2Storage::Filesystems::Type::BTRFS
        spec.min_size = Y2Storage::DiskSize.GiB(5)
        spec.max_size = Y2Storage::DiskSize.GiB(20)
        spec.snapshots = true
        spec.subvolumes = ["@/home", "@/var"]
        spec.btrfs_default_subvolume = "@"
        spec.btrfs_read_only = true
      end
    end

    it "converts the Y2Storage volume spec to an Agama volume" do
      volume = subject.convert

      expect(volume).to be_a(Agama::Storage::Volume)
      expect(volume).to have_attributes(
        mount_path:    "/",
        location:      an_object_having_attributes(
          device: "/dev/sda",
          target: :new_vg
        ),
        mount_options: contain_exactly("defaults", "ro"),
        fs_type:       Y2Storage::Filesystems::Type::BTRFS,
        min_size:      Y2Storage::DiskSize.GiB(5),
        max_size:      Y2Storage::DiskSize.GiB(20),
        btrfs:         an_object_having_attributes(
          snapshots?:        true,
          subvolumes:        contain_exactly("@/home", "@/var"),
          default_subvolume: "@",
          read_only?:        true
        )
      )

      outline = Agama::Storage::VolumeTemplatesBuilder.new_from_config(config).for("/").outline
      expect(volume.outline).to eq_outline(outline)
    end

    context "auto size conversion" do
      before do
        spec.ignore_fallback_sizes = ignore_fallback_sizes
        spec.ignore_snapshots_sizes = ignore_snapshots_sizes
      end

      context "if :ignore_fallback_sizes and :ignore_snapshots_sizes are set" do
        let(:ignore_fallback_sizes) { true }

        let(:ignore_snapshots_sizes) { true }

        it "does not set auto size" do
          volume = subject.convert

          expect(volume).to have_attributes(
            auto_size?: false
          )
        end
      end

      context "if :ignore_fallback_sizes and :ignore_snapshots_sizes are not set" do
        let(:ignore_fallback_sizes) { false }

        let(:ignore_snapshots_sizes) { false }

        it "sets auto size" do
          volume = subject.convert

          expect(volume).to have_attributes(
            auto_size?: true
          )
        end
      end
    end

    context "sizes conversion" do
      before do
        allow(Y2Storage::StorageManager.instance).to receive(:proposal).and_return(proposal)
      end

      let(:proposal) do
        instance_double(Y2Storage::MinGuidedProposal, planned_devices: planned_devices)
      end

      context "if there is a planned device for the volume" do
        let(:planned_devices) { [planned_volume] }

        let(:planned_volume) do
          Y2Storage::Planned::LvmLv.new("/").tap do |planned|
            planned.min = Y2Storage::DiskSize.GiB(10)
            planned.max = Y2Storage::DiskSize.GiB(40)
          end
        end

        it "sets the min and max sizes according to the planned device" do
          volume = subject.convert

          expect(volume).to have_attributes(
            min_size: Y2Storage::DiskSize.GiB(10),
            max_size: Y2Storage::DiskSize.GiB(40)
          )
        end
      end

      context "if there is no planned device for the volume" do
        let(:planned_devices) { [planned_volume] }

        let(:planned_volume) do
          Y2Storage::Planned::LvmLv.new("/home").tap do |planned|
            planned.min = Y2Storage::DiskSize.GiB(10)
            planned.max = Y2Storage::DiskSize.GiB(40)
          end
        end

        it "sets the min and max sizes according to the volume spec" do
          volume = subject.convert

          expect(volume).to have_attributes(
            min_size: Y2Storage::DiskSize.GiB(5),
            max_size: Y2Storage::DiskSize.GiB(20)
          )
        end
      end
    end
  end
end
