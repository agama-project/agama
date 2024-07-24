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

require_relative "../agama/storage/storage_helpers"
require "agama/config"
require "agama/storage/config"
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  include Agama::RSpec::StorageHelpers

  before do
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
  end

  subject(:proposal) do
    described_class.new(initial_settings, issues_list: issues_list)
  end
  let(:initial_settings) do
    Agama::Storage::Config.new.tap do |settings|
      settings.drives = [root_drive]
    end
  end
  let(:root_drive) do
    Agama::Storage::Configs::Drive.new.tap do |drive|
      drive.partitions = [
        Agama::Storage::Configs::Partition.new.tap do |part|
          part.mount = Agama::Storage::Configs::Mount.new.tap { |m| m.path = "/" }
          part.size = Agama::Storage::Configs::Size.new.tap do |size|
            size.min = Y2Storage::DiskSize.GiB(8.5)
            size.max = Y2Storage::DiskSize.unlimited
          end
        end
      ]
    end
  end
  let(:issues_list) { [] }

  describe "#propose" do
    context "when only the root partition is specified" do
      context "if no configuration about boot devices is specified" do
        it "proposes to create the root device and the boot-related partition" do
          proposal.propose
          partitions = proposal.devices.partitions
          expect(partitions.size).to eq 2
          expect(partitions.first.id).to eq Y2Storage::PartitionId::BIOS_BOOT
          root_part = partitions.last
          expect(root_part.size).to be > Y2Storage::DiskSize.GiB(49)
          # root_fs = root_part.filesystem
          # expect(root_fs.root?).to eq true
          # expect(root_fs.type.is?(:btrfs)).to eq true
        end
      end

      context "if no boot devices should be created" do
        before do
          initial_settings.boot = Agama::Storage::BootSettings.new.tap { |b| b.configure = false }
        end

        it "proposes to create only the root device" do
          proposal.propose
          partitions = proposal.devices.partitions
          expect(partitions.size).to eq 1
          root_part = partitions.first
          expect(root_part.id).to eq Y2Storage::PartitionId::LINUX
          expect(root_part.size).to be > Y2Storage::DiskSize.GiB(49)
          # root_fs = root_part.filesystem
          # expect(root_fs.root?).to eq true
          # expect(root_fs.type.is?(:btrfs)).to eq true
        end
      end
    end
  end
end
