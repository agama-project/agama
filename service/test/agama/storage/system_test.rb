# frozen_string_literal: true

# Copyright (c) [2025-2026] SUSE LLC
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

require_relative "./storage_helpers"
require "agama/storage/system"

describe Agama::Storage::System do
  include Agama::RSpec::StorageHelpers

  before { mock_storage(devicegraph: scenario) }

  let(:disk_analyzer) { Y2Storage::StorageManager.instance.probed_disk_analyzer }

  describe "#candidate_devices" do
    let(:scenario) { "md_raids.yaml" }

    before do
      allow(disk_analyzer).to receive(:supports_boot_partitions?) { |d| d.name != "/dev/md2" }
    end

    it "includes all devices suitable for installation" do
      expect(subject.candidate_devices.map(&:name))
        .to contain_exactly("/dev/vda", "/dev/vdb")
    end
  end

  describe "#candidate_drives" do
    let(:scenario) { "disks.yaml" }

    before do
      allow(disk_analyzer).to receive(:available_device?) { |d| d.name != "/dev/vdb" }
    end

    it "includes all drives suitable for installation" do
      expect(subject.candidate_drives.map(&:name)).to contain_exactly("/dev/vda", "/dev/vdc")
    end

    context "if there are MD RAIDs" do
      let(:scenario) { "md_raids.yaml" }

      before do
        allow(disk_analyzer).to receive(:available_device?).and_call_original
      end

      it "does not include MD RAIDs" do
        expect(subject.candidate_drives.map(&:name)).to contain_exactly("/dev/vda", "/dev/vdb")
      end
    end
  end

  describe "#available_md_raids" do
    let(:scenario) { "available_md_raids.yaml" }

    it "includes all software RAIDs that are not in use" do
      expect(subject.available_md_raids.map(&:name)).to contain_exactly("/dev/md0", "/dev/md1")
    end

    it "does not include software RAIDs in use" do
      expect(subject.available_md_raids.map(&:name)).to_not include("/dev/md2")
    end

    it "does not include software RAIDs over devices in use" do
      expect(subject.available_md_raids.map(&:name)).to_not include("/dev/md3")
    end
  end

  describe "#candidate_md_raids" do
    let(:scenario) { "md_raids.yaml" }

    it "returns an empty list if there are only software RAIDs" do
      expect(subject.candidate_md_raids).to be_empty
    end
  end

  describe "#available_volume_groups  " do
    let(:scenario) { "available_volume_groups.yaml" }

    it "includes all volume groups that are not in use" do
      expect(subject.available_volume_groups.map(&:name)).to contain_exactly("/dev/vg0", "/dev/vg1")
    end

    it "does not include volume groups in use" do
      expect(subject.available_volume_groups.map(&:name)).to_not include("/dev/vg2")
    end

    it "does not include volume groups over devices in use" do
      expect(subject.available_volume_groups.map(&:name)).to_not include("/dev/vg3")
    end
  end
end
