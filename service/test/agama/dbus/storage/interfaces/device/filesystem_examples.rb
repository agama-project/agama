# frozen_string_literal: true

# Copyright (c) [2024] SUSE LLC
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
require "y2storage/filesystem_label"

shared_examples "Filesystem interface" do
  describe "Filesystem D-Bus interface" do
    let(:scenario) { "multipath-formatted.xml" }

    let(:device) { devicegraph.find_by_name("/dev/mapper/0QEMU_QEMU_HARDDISK_mpath1") }

    describe "#filesystem_type" do
      it "returns the file system type" do
        expect(subject.filesystem_type).to eq("ext4")
      end
    end

    describe "#filesystem_mount_path" do
      context "if the file system is mounted" do
        before do
          device.filesystem.mount_path = "/test"
        end

        it "returns the mount path" do
          expect(subject.filesystem_mount_path).to eq("/test")
        end
      end

      context "if the file system is not mounted" do
        before do
          device.filesystem.mount_path = ""
        end

        it "returns empty string" do
          expect(subject.filesystem_mount_path).to eq("")
        end
      end
    end

    describe "#filesystem_label" do
      before do
        allow(Y2Storage::FilesystemLabel).to receive(:new).with(device).and_return(label)
      end

      let(:label) { instance_double(Y2Storage::FilesystemLabel, to_s: "photos") }

      it "returns the label of the file system" do
        expect(subject.filesystem_label).to eq("photos")
      end
    end
  end
end
