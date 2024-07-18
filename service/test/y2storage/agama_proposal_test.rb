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
require "agama/storage/profile"
require "y2storage/agama_proposal"

describe Y2Storage::AgamaProposal do
  include Agama::RSpec::StorageHelpers

  before do
    mock_storage(devicegraph: "empty-hd-50GiB.yaml")
    allow(Y2Storage::Proposal::AgamaDevicesPlanner).to receive(:new).and_return dev_generator
    allow(dev_generator).to receive(:add_boot_devices)
  end

  subject(:proposal) do
    described_class.new(initial_settings, config, issues_list: issues_list)
  end
  let(:config) { Agama::Config.new }
  let(:initial_settings) do
    Agama::Storage::Profile.new.tap do |settings|
      settings.drives = [drive]
    end
  end
  let(:drive) do
    Agama::Storage::Settings::Drive.new.tap do |drive|
      drive.partitions = [
        Agama::Storage::Settings::Partition.new.tap do |part|
          part.mount = Agama::Storage::Settings::Mount.new.tap { |m| m.path = "/" }
        end
      ]
    end
  end
  let(:issues_list) { [] }
  let(:dev_generator) do
    instance_double(
      "Y2Storage::Proposal::AgamaDevicesPlanner", initial_planned_devices: planned_devices
    )
  end
  let(:planned_devices) do
    [planned_partition(mount_point: "/", type: :ext4, min: Y2Storage::DiskSize.GiB(8.5))]
  end

  describe "#propose" do
    it "does something" do
      proposal.propose
      expect(proposal.devices.partitions.size).to eq 1
    end
  end
end
