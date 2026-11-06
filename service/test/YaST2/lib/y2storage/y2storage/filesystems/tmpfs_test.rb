#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2020] SUSE LLC
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

require "y2storage"

describe Y2Storage::Filesystems::Tmpfs do
  include_context "yast2-storage-ng test setup"

  before do
    Y2Storage::StorageManager.create_test_instance

    allow(Yast::SCR).to receive(:Read)
    # Let's assume 8 GiB of RAM
    allow(Yast::SCR).to receive(:Read).with(path(".proc.meminfo"))
      .and_return("memtotal" => 8388608)

    # And a block size of 4K
    allow(Y2Storage::StorageManager.instance.arch).to receive(:page_size).and_return 4096
  end

  subject(:filesystem) { described_class.create(fake_devicegraph) }

  describe "#size" do
    context "if there is no mount point (which should never happen)" do
      it "returns half of the ram size (tmpfs default)" do
        expect(filesystem.size).to eq Y2Storage::DiskSize.GiB(4)
      end
    end

    context "if there is a mount point (which is the only supported case)" do
      before { filesystem.mount_path = "/tmp" }

      it "returns half of the ram size (tmpfs default) if there are no mount options" do
        expect(filesystem.size).to eq Y2Storage::DiskSize.GiB(4)
      end

      it "returns the size limit directly specified as a size= mount option" do
        filesystem.mount_point.mount_options = ["rw", "size=128M", "noatime"]

        expect(filesystem.size).to eq Y2Storage::DiskSize.MiB(128)
      end

      it "returns the size limit specified as a percentage in the size= mount option" do
        filesystem.mount_point.mount_options = ["rw", "size=25%"]

        expect(filesystem.size).to eq Y2Storage::DiskSize.GiB(2)
      end

      it "returns zero if the size= mount option contains an invalid value" do
        filesystem.mount_point.mount_options = ["size=big", "rw"]

        expect(filesystem.size).to eq Y2Storage::DiskSize.zero
      end

      it "returns the size limit specified with the nr_blocks= mount option" do
        filesystem.mount_point.mount_options = ["size=whatever", "nr_blocks=25k"]

        expect(filesystem.size).to eq(Y2Storage::DiskSize.KiB(25) * 4096)
      end

      it "returns zero if the nr_blocks= mount option contains an invalid value" do
        filesystem.mount_point.mount_options = ["nr_blocks=many"]

        expect(filesystem.size).to eq Y2Storage::DiskSize.zero
      end

      it "returns the size specified by the last option if several ones are given" do
        filesystem.mount_point.mount_options = ["size=128M", "nr_blocks=25k", "size=25%"]
        expect(filesystem.size).to eq Y2Storage::DiskSize.GiB(2)

        filesystem.mount_point.mount_options = ["size=25%", "size=128M", "nr_blocks=25k"]
        expect(filesystem.size).to eq(Y2Storage::DiskSize.KiB(25) * 4096)

        filesystem.mount_point.mount_options = ["size=25%", "nr_blocks=25k", "size=128M"]
        expect(filesystem.size).to eq Y2Storage::DiskSize.MiB(128)
      end
    end
  end

  describe "#name" do
    it "returns an string" do
      expect(filesystem.name).to be_a(String)
    end

    it "includes the type and the mount path of the filesystem" do
      filesystem.mount_path = "/tmp"

      expect(filesystem.name).to eq("Tmpfs /tmp")
    end
  end
end
