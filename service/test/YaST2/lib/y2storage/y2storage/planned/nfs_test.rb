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

require_relative "../../../../../test_helper"
require_relative "../../support/shared_setup"

require "y2storage/planned"

describe Y2Storage::Planned::Nfs do
  include_context "yast2-storage-ng test setup"

  using Y2Storage::Refinements::SizeCasts

  subject do
    nfs = described_class.new(nfs_server, nfs_path)
    nfs.mount_point = nfs_mount_point
    nfs
  end
  let(:nfs_server) { "testserver" }
  let(:nfs_path) { "/work/data" }
  let(:nfs_mount_point) { "/nfs/work/data" }

  describe "match_volume?" do
    let(:volume) { Y2Storage::VolumeSpecification.new({}) }
    let(:excludes) { [:size, :partition_id] }

    before do
      volume.fs_types = volume_fs_types
      volume.mount_point = volume_mount_point
    end

    context "when the planned nfs has the same values" do
      let(:volume_fs_types) { [Y2Storage::Filesystems::Type::NFS] }
      let(:volume_mount_point) { nfs_mount_point }

      it "returns true" do
        expect(subject.match_volume?(volume, exclude: excludes)).to eq(true)
      end
    end

    context "when the the wrong filesystem type is expected" do
      let(:volume_fs_types) { [Y2Storage::Filesystems::Type::EXT4] }
      let(:volume_mount_point) { nfs_mount_point }

      it "returns false" do
        expect(subject.match_volume?(volume, exclude: excludes)).to eq(false)
      end
    end

    context "when the another mount point is expected" do
      let(:volume_fs_types) { [Y2Storage::Filesystems::Type::EXT4] }
      let(:volume_mount_point) { "/wrong/mount/point" }

      it "returns false" do
        expect(subject.match_volume?(volume, exclude: excludes)).to eq(false)
      end
    end
  end
end
