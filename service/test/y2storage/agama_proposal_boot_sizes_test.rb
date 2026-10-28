# frozen_string_literal: true

# Copyright (c) [2026] SUSE LLC
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

require_relative "../agama/storage/storage_helpers"
require "agama/config"
require "agama/storage/config"
require "agama/storage/config_conversions"
require "agama/storage/system"
require "y2storage"
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  using Y2Storage::Refinements::SizeCasts
  include Agama::RSpec::StorageHelpers

  subject(:proposal) do
    described_class.new(config, storage_system, bootloader_config: bootloader_config)
  end

  let(:bootloader_config) { instance_double(Agama::Storage::BootloaderConfig, type: bootloader) }

  let(:storage_system) { Agama::Storage::System.new }

  let(:config) { config_from_json }

  let(:config_from_json) do
    Agama::Storage::ConfigConversions::FromJSON.new(config_json).convert
  end

  describe "#propose (when existing partitions need to be resized)" do
    before do
      mock_storage(devicegraph: scenario)
      allow_any_instance_of(Y2Storage::Arch).to receive(:efiboot?).and_return(true)
      allow(Yast::Arch).to receive(:x86_64).and_return(true)
      allow(Yast::Arch).to receive(:i386).and_return(false)
      allow(Yast::Arch).to receive(:aarch64).and_return(false)
      allow_any_instance_of(Y2Storage::Partition)
        .to(receive(:detect_resize_info))
        .and_return(resize_info)
    end

    let(:scenario) { "disks.yaml" }

    let(:resize_info) do
      instance_double(Y2Storage::ResizeInfo, resize_ok?: true, min_size: 5.GiB, max_size: 10.GiB)
    end

    let(:config_json) do
      {
        boot:   { configure: true },
        drives: [
          {
            search:     "/dev/vda",
            partitions: [
              # Shrink vda3 to make room
              { search: "/dev/vda3", size: { min: 0, max: "current" } },
              # Request root partition that requires some resizing
              { size: { min: root_min }, filesystem: { path: "/" } }
            ]
          }
        ]
      }
    end

    context "if the desired and min sizes are different" do
      let(:bootloader) { Y2Storage::BootloaderType::GRUB2 }

      context "and it is possible to resize enough to get the desired boot partitions" do
        let(:root_min) { "24 GiB" }

        it "creates boot partitions with the desired sizes" do
          devicegraph = proposal.propose
          boot_partition = devicegraph.partitions.find { |p| p.id.is?(:esp) }
          expect(boot_partition.size).to eq 256.MiB
        end
      end

      context "and it is not possible to resize enough to get the desired boot partitions" do
        let(:root_min) { "24.75 GiB" }

        it "creates boot partitions with the min sizes if possible" do
          devicegraph = proposal.propose
          boot_partition = devicegraph.partitions.find { |p| p.id.is?(:esp) }
          expect(boot_partition.size).to eq 128.MiB
        end
      end

      context "and it is not possible to resize enough to get the minimal boot partitions" do
        let(:root_min) { "25 GiB" }

        it "raises a NoDiskSpaceError" do
          expect { proposal.propose }.to raise_error Y2Storage::NoDiskSpaceError
        end
      end
    end

    context "if the desired and min sizes are equal" do
      let(:bootloader) { Y2Storage::BootloaderType::SYSTEMD_BOOT }

      context "and it is possible to resize enough to get the desired boot partitions" do
        let(:root_min) { "23.5 GiB" }

        it "creates boot partitions with the desired sizes" do
          devicegraph = proposal.propose
          boot_partition = devicegraph.partitions.find { |p| p.id.is?(:esp) }
          expect(boot_partition.size).to eq 1.GiB
        end
      end

      context "and it is not possible to resize enough to get the desired boot partitions" do
        let(:root_min) { "25 GiB" }

        it "raises a NoDiskSpaceError" do
          expect { proposal.propose }.to raise_error Y2Storage::NoDiskSpaceError
        end
      end
    end
  end
end
