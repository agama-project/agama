#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2018] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "y2storage"

require "y2storage/volume_specification_builder"

describe Y2Storage::VolumeSpecificationBuilder do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts
  subject(:builder) { described_class.new(settings) }

  let(:settings) do
    instance_double(Y2Storage::ProposalSettings, volumes: volumes)
  end

  let(:volumes) { [home_spec] }
  let(:home_spec) { Y2Storage::VolumeSpecification.new("mount_point" => "/home") }

  describe "#for" do
    context "when a volume specification for the given mount point exist" do
      it "returns the existing specification" do
        expect(builder.for("/home")).to eq(home_spec)
      end
    end

    context "when a volume specification nor a fallback for the given mount point does not exist" do
      it "returns nil" do
        expect(builder.for("home")).to be_nil
      end

      context "and mount point is /boot" do
        it "returns a /boot volume specification" do
          expect(builder.for("/boot")).to have_attributes(
            mount_point:  "/boot",
            fs_types:     Y2Storage::Filesystems::Type.root_filesystems,
            fs_type:      Y2Storage::Filesystems::Type::EXT4,
            min_size:     100.MiB,
            desired_size: 200.MiB,
            max_size:     500.MiB
          )
        end
      end

      context "when mount point is /boot/efi" do
        it "returns a /boot/efi volume specification" do
          expect(builder.for("/boot/efi")).to have_attributes(
            mount_point:  "/boot/efi",
            fs_types:     [Y2Storage::Filesystems::Type::VFAT],
            fs_type:      Y2Storage::Filesystems::Type::VFAT,
            min_size:     128.MiB,
            desired_size: 256.MiB,
            max_size:     512.MiB
          )
        end
      end

      context "when mount point is /boot/zipl" do
        it "returns a /boot/zipl volume specification" do
          expect(builder.for("/boot/zipl")).to have_attributes(
            mount_point:  "/boot/zipl",
            fs_types:     Y2Storage::Filesystems::Type.zipl_filesystems,
            fs_type:      Y2Storage::Filesystems::Type.zipl_filesystems.first,
            min_size:     100.MiB,
            desired_size: 200.MiB,
            max_size:     300.MiB
          )
        end
      end

      context "when is a grub2 partition" do
        it "returns a grub2 partition volume specification" do
          expect(builder.for("grub")).to have_attributes(
            min_size:     2.MiB,
            desired_size: 4.MiB,
            max_size:     8.MiB,
            partition_id: Y2Storage::PartitionId::BIOS_BOOT
          )
        end
      end

      context "when is a prep partition" do
        it "returns a prep partition volume specification" do
          expect(builder.for("prep")).to have_attributes(
            min_size:       2.MiB,
            desired_size:   4.MiB,
            max_size:       8.MiB,
            max_size_limit: 8.MiB,
            partition_id:   Y2Storage::PartitionId::PREP
          )
        end
      end

      context "when is a swap partition" do
        it "returns a swap volume specification" do
          expect(builder.for("swap")).to have_attributes(
            mount_point: "swap",
            fs_type:     Y2Storage::Filesystems::Type::SWAP,
            min_size:    512.MiB,
            max_size:    2.GiB
          )
        end
      end
    end
  end
end
