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
require "agama/config"
require "agama/storage/autoyast_proposal"
require "y2storage"

describe Agama::Storage::AutoyastProposal do
  include Agama::RSpec::StorageHelpers
  using Y2Storage::Refinements::SizeCasts

  subject(:proposal) { described_class.new(config, logger: logger) }

  before do
    mock_storage(devicegraph: scenario)
    allow(Y2Storage::StorageManager.instance).to receive(:arch).and_return(arch)
  end

  let(:scenario) { "windows-linux-pc.yml" }

  let(:arch) do
    instance_double(Y2Storage::Arch, efiboot?: true, ram_size: 4.GiB.to_i)
  end

  let(:logger) { Logger.new($stdout, level: :warn) }

  let(:config_path) do
    File.join(FIXTURES_PATH, "storage.yaml")
  end
  let(:config) { Agama::Config.from_file(config_path) }

  describe "#calculate" do
    def staging
      Y2Storage::StorageManager.instance.proposal.devices
    end

    def root_filesystem(disk)
      disk.partitions.map(&:filesystem).compact.find(&:root?)
    end

    ROOT_PART = {
      "filesystem" => :ext4, "mount" => "/", "size" => "25%", "label" => "new_root"
    }.freeze

    let(:root) { ROOT_PART.merge("create" => true) }
    let(:home) do
      { "filesystem" => :xfs, "mount" => "/home", "size" => "50%", "create" => true }
    end
    let(:swap) do
      { "filesystem" => :swap, "mount" => "swap", "size" => "1GB", "create" => true }
    end

    describe "when partitions are specified" do
      context "if the requested layout is valid" do
        let(:partitioning) do
          [{ "device" => "/dev/sda", "use" => "all", "partitions" => [root, home] }]
        end

        it "returns true and stores a successful proposal" do
          expect(subject.calculate(partitioning)).to eq true
          expect(Y2Storage::StorageManager.instance.proposal.failed?).to eq false
        end

        it "proposes a layout including specified partitions" do
          subject.calculate(partitioning)

          sda_partitions = staging.find_by_name("/dev/sda").partitions.sort_by(&:number)
          expect(sda_partitions.size).to eq(3)
          efi, root, home = sda_partitions

          expect(efi).to have_attributes(
            filesystem_type:       Y2Storage::Filesystems::Type::VFAT,
            filesystem_mountpoint: "/boot/efi",
            size:                  512.MiB
          )

          expect(root).to have_attributes(
            filesystem_type:       Y2Storage::Filesystems::Type::EXT4,
            filesystem_mountpoint: "/",
            size:                  125.GiB
          )

          expect(home).to have_attributes(
            filesystem_type:       Y2Storage::Filesystems::Type::XFS,
            filesystem_mountpoint: "/home",
            size:                  250.GiB
          )
        end

        xit "registers no issues" do
        end

        it "runs all the callbacks" do
          callback1 = proc {}
          callback2 = proc {}

          subject.on_calculate(&callback1)
          subject.on_calculate(&callback2)

          expect(callback1).to receive(:call)
          expect(callback2).to receive(:call)

          subject.calculate(partitioning)
        end
      end

      context "if no root is specified" do
        let(:partitioning) do
          [{ "device" => "/dev/sda", "use" => "all", "partitions" => [home] }]
        end

        it "returns true and stores a successful proposal" do
          expect(subject.calculate(partitioning)).to eq true
          expect(Y2Storage::StorageManager.instance.proposal.failed?).to eq false
        end

        it "proposes a layout including only the specified partitions" do
          subject.calculate(partitioning)

          sda_partitions = staging.find_by_name("/dev/sda").partitions
          # Only /boot/efi and /home, no root filesystem
          expect(sda_partitions.size).to eq(2)
        end

        xit "registers an issue" do
        end

        it "runs all the callbacks" do
          callback1 = proc {}
          callback2 = proc {}

          subject.on_calculate(&callback1)
          subject.on_calculate(&callback2)

          expect(callback1).to receive(:call)
          expect(callback2).to receive(:call)

          subject.calculate(partitioning)
        end
      end
    end

    describe "when existing partitions should be kept" do
      let(:partitioning) do
        [{ "device" => "/dev/#{disk}", "use" => "free", "partitions" => [root] }]
      end
      
      context "if the requested partitions fit into the available space" do
        let(:disk) { "sdb" }

        it "proposes a layout including previous and new partitions" do
          subject.calculate(partitioning)
          sdb_partitions = staging.find_by_name("/dev/sdb").partitions
          expect(sdb_partitions.size).to eq 3
        end
      end

      context "if there is no available space" do
        let(:disk) { "sda" }

        xit "todo: what is expected?" do
        end
      end
    end

    context "when only space from Linux partitions should be used" do
      let(:partitioning) do
        [{ "device" => "/dev/sda", "use" => "linux", "partitions" => [root] }]
      end

      it "keeps all partitions except Linux ones" do
        subject.calculate(partitioning)
        partitions = staging.find_by_name("/dev/sda").partitions
        expect(partitions.map(&:filesystem_label)).to contain_exactly("windows", "", "new_root")
      end
    end

    describe "reusing partitions" do 
      let(:partitioning) do
        [{ "device" => "/dev/sdb", "partitions" => [root] }]
      end

      let(:root) do
        { "mount" => "/", "partition_nr" => 1, "create" => false }
      end

      it "reuses the indicated partition" do
        subject.calculate(partitioning)
        root, efi = staging.find_by_name("/dev/sdb").partitions.sort_by(&:number)
        expect(root).to have_attributes(
          filesystem_type:       Y2Storage::Filesystems::Type::XFS,
          filesystem_mountpoint: "/",
          size:                  113.GiB
        )
        expect(efi).to have_attributes(
          filesystem_type:       Y2Storage::Filesystems::Type::VFAT,
          filesystem_mountpoint: "/boot/efi",
          id:                    Y2Storage::PartitionId::ESP,
          size:                  512.MiB
        )
      end

      context "if the partitions needed for booting do not fit" do
        let(:partitioning) do
          [{ "device" => "/dev/sda", "partitions" => [root] }]
        end

        let(:root) do
          { "mount" => "/", "partition_nr" => 3, "create" => false }
        end

        it "does not create the boot partitions" do
          subject.calculate(partitioning)
          partitions = staging.find_by_name("/dev/sda").partitions
          expect(partitions.size).to eq 3
          expect(partitions.map(&:id)).to_not include Y2Storage::PartitionId::ESP
        end

        xit "registers an issue" do
        end
      end
    end

    describe "skipping disks" do
      let(:skip_list) do
        [{ "skip_key" => "name", "skip_value" => skip_device }]
      end

      let(:partitioning) do
        [{ "use" => "all", "partitions" => [root, home], "skip_list" => skip_list }]
      end

      context "when no disk is included in the skip_list" do
        let(:skip_device) { "sdc" }

        it "does not skip any disk" do
          subject.calculate(partitioning)
          sda = staging.find_by_name("/dev/sda")
          expect(root_filesystem(sda)).to_not be_nil
        end
      end

      context "when a disk is included in the skip_list" do
        let(:skip_device) { "sda" }

        it "skips the given disk" do
          subject.calculate(partitioning)
          sda = staging.find_by_name("/dev/sda")
          sdb = staging.find_by_name("/dev/sdb")
          expect(root_filesystem(sda)).to be_nil
          expect(root_filesystem(sdb)).to_not be_nil
        end
      end

      context "when all disks are skipped" do
        let(:skip_list) do
          [{ "skip_key" => "name", "skip_value" => "sda" },
           { "skip_key" => "name", "skip_value" => "sdb" }]
        end

        it "returns false and stores a failed proposal" do
          expect(subject.calculate(partitioning)).to eq false
          expect(Y2Storage::StorageManager.instance.proposal.failed?).to eq true
        end

        xit "registers an issue" do
        end
      end
    end

    xdescribe "LVM on RAID" do
    end

    xdescribe "using 'auto' for the size of some partitions" do
    end

    describe "automatic partitioning" do
      let(:partitioning) do
        [
          {
            "device"           => "/dev/sda",
            "use"              => use,
            "enable_snapshots" => snapshots
          }
        ]
      end

      let(:use) { "all" }
      let(:snapshots) { true }

      it "falls back to the initial guided proposal with the given disk" do
        subject.calculate(partitioning)

        partitions = staging.find_by_name("/dev/sda").partitions.sort_by(&:number)
        expect(partitions.size).to eq(3)
        expect(partitions[0].id.is?(:esp)).to eq(true)
        expect(partitions[1].filesystem.root?).to eq(true)
        expect(partitions[2].filesystem.mount_path).to eq("swap")
      end

      context "when a subset of partitions should be used" do
        let(:use) { "1" }

        # Since we use :bigger_resize, there is no compatibility with "use"
        it "keeps partitions that should not be removed" do
          subject.calculate(partitioning)

          partitions = staging.find_by_name("/dev/sda").partitions
          partitions.reject! { |p| p.type.is?(:extended) }
          expect(partitions.size).to eq(5)
        end
      end

      context "when snapshots are enabled in the AutoYaST profile" do
        let(:snapshots) { true }

        it "configures snapshots for root" do
          subject.calculate(partitioning)

          sda = staging.find_by_name("/dev/sda")
          root = root_filesystem(sda)
          expect(root.snapshots?).to eq(true)
        end
      end

      context "when snapshots are disabled in the AutoYaST profile" do
        let(:snapshots) { false }

        it "does not configure snapshots for root" do
          subject.calculate(partitioning)

          sda = staging.find_by_name("/dev/sda")
          root = root_filesystem(sda)
          expect(root.snapshots?).to eq(false)
        end
      end

      it "runs all the callbacks" do
        callback1 = proc {}
        callback2 = proc {}

        subject.on_calculate(&callback1)
        subject.on_calculate(&callback2)

        expect(callback1).to receive(:call)
        expect(callback2).to receive(:call)

        subject.calculate(partitioning)
      end
    end
  end
end
