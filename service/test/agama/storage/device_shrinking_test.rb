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

require_relative "../../test_helper"
require_relative "storage_helpers"
require "agama/storage/device_shrinking"
require "y2storage"

describe Agama::Storage::DeviceShrinking do
  include Agama::RSpec::StorageHelpers

  subject { described_class.new(device) }

  let(:device) { target.find_by_name(device_name) }

  let(:resize_info) do
    instance_double(Y2Storage::ResizeInfo, min_size: min_size, reasons: reasons)
  end

  let(:min_size) { Y2Storage::DiskSize.zero }

  let(:reasons) { [] }

  let(:system) { Y2Storage::StorageManager.instance.probed }

  let(:target) { Y2Storage::StorageManager.instance.staging }

  before do
    mock_storage(devicegraph: "partitioned_md.yml")

    sdb = target.find_by_name("/dev/sdb")
    gpt = sdb.create_partition_table(Y2Storage::PartitionTables::Type::GPT)
    gpt.create_partition(
      "/dev/sdb1",
      Y2Storage::Region.create(2048, 1048576, 512),
      Y2Storage::PartitionType::PRIMARY
    )

    allow(device).to receive(:resize_info).and_return(resize_info)
  end

  describe "#supported?" do
    shared_examples "supported checks" do
      context "and the min size for resizing is 0" do
        let(:min_size) { Y2Storage::DiskSize.zero }

        it "returns false" do
          expect(subject.supported?).to eq(false)
        end
      end

      context "and the min size for resizing is equal to the device size" do
        let(:min_size) { device.size }

        it "returns false" do
          expect(subject.supported?).to eq(false)
        end
      end

      context "and the min size for resizing is valid" do
        let(:min_size) { Y2Storage::DiskSize.MiB(100) }

        context "and there is some reasons preventing to shrink" do
          let(:reasons) { [:RB_MIN_SIZE_FOR_FILESYSTEM] }

          it "returns false" do
            expect(subject.supported?).to eq(false)
          end
        end

        context "and there is some reasons preventing to resize" do
          let(:reasons) { [:RB_RESIZE_NOT_SUPPORTED_BY_DEVICE] }

          it "returns false" do
            expect(subject.supported?).to eq(false)
          end
        end

        context "and there is no reason" do
          let(:reasons) { [] }

          it "returns true" do
            expect(subject.supported?).to eq(true)
          end
        end
      end
    end

    context "if the device does not exist in the system yet" do
      let(:device_name) { "/dev/sdb1" }

      include_examples "supported checks"
    end

    context "if the device already exists in the system" do
      context "and it has no content" do
        let(:device_name) { "/dev/md0p1" }

        it "returns false" do
          expect(subject.supported?).to eq(false)
        end
      end

      context "and it has content" do
        let(:device_name) { "/dev/sda1" }

        include_examples "supported checks"
      end
    end
  end

  describe "#min_size" do
    let(:min_size) { Y2Storage::DiskSize.MiB(100) }

    context "if shrinking is not supported" do
      let(:device_name) { "/dev/md0p1" }

      it "returns nil" do
        expect(subject.min_size).to be_nil
      end
    end

    context "if shrinking is supported" do
      let(:device_name) { "/dev/sda1" }

      it "returns the min size the device can be shrunk to" do
        expect(subject.min_size).to eq(min_size)
      end
    end
  end

  describe "#unsupported_reasons" do
    let(:min_size) { Y2Storage::DiskSize.MiB(100) }

    context "if shrinking is supported" do
      let(:device_name) { "/dev/sda1" }

      it "returns nl" do
        expect(subject.unsupported_reasons).to be_nil
      end
    end

    context "if shrinking is not supported" do
      let(:device_name) { "/dev/md0p1" }

      it "returns the list of reasons" do
        expect(subject.unsupported_reasons).to contain_exactly(
          /a file system nor a storage system was detected/
        )
      end
    end
  end
end
