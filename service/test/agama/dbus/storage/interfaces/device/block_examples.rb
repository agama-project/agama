# frozen_string_literal: true

# Copyright (c) [2023-2024] SUSE LLC
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

shared_examples "Block interface" do
  describe "Block D-Bus interface" do
    let(:scenario) { "partitioned_md.yml" }

    let(:device) { devicegraph.find_by_name("/dev/sda") }

    describe "#block_name" do
      it "returns the name of the device" do
        expect(subject.block_name).to eq("/dev/sda")
      end
    end

    describe "#block_active" do
      before do
        allow(device).to receive(:active?).and_return(true)
      end

      it "returns whether the device is active" do
        expect(subject.block_active).to eq(true)
      end
    end

    describe "#block_udev_ids" do
      before do
        allow(device).to receive(:udev_ids).and_return(udev_ids)
      end

      let(:udev_ids) { ["ata-Micron_1100_SATA_512GB_12563", "scsi-0ATA_Micron_1100_SATA_512GB"] }

      it "returns the list of udev ids" do
        expect(subject.block_udev_ids).to contain_exactly(*udev_ids)
      end
    end

    describe "#block_udev_paths" do
      before do
        allow(device).to receive(:udev_paths).and_return(udev_paths)
      end

      let(:udev_paths) { ["pci-0000:00-12", "pci-0000:00-12-ata"] }

      it "returns the list of udev paths" do
        expect(subject.block_udev_paths).to contain_exactly(*udev_paths)
      end
    end

    describe "#block_size" do
      before do
        allow(device).to receive(:size).and_return(size)
      end

      let(:size) { Y2Storage::DiskSize.new(1024) }

      it "returns the size in bytes" do
        expect(subject.block_size).to eq(1024)
      end
    end

    describe "#block_recoverable_size" do
      before do
        allow(device).to receive(:recoverable_size).and_return(size)
      end

      let(:size) { Y2Storage::DiskSize.new(1024) }

      it "returns the recoverable size in bytes" do
        expect(subject.block_recoverable_size).to eq(1024)
      end
    end

    describe "#block_systems" do
      let(:filesystem1) { instance_double(Y2Storage::Filesystems::Base, is?: false) }
      let(:filesystem2) { instance_double(Y2Storage::Filesystems::Base, is?: false) }

      before do
        allow(filesystem1).to receive(:is?).with(:filesystem).and_return(true)
        allow(filesystem1).to receive(:system_name).and_return("Windows")
        allow(filesystem2).to receive(:is?).with(:filesystem).and_return(true)
        allow(filesystem2).to receive(:system_name).and_return("openSUSE")

        allow(device).to receive(:descendants).and_return([filesystem1, filesystem2])
      end

      it "returns the name of the installed systems" do
        expect(subject.block_systems).to contain_exactly("Windows", "openSUSE")
      end
    end
  end
end
