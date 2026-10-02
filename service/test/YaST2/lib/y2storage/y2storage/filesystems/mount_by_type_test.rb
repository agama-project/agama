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
require "y2storage"

describe Y2Storage::Filesystems::MountByType do
  include_context "yast2-storage-ng test setup"

  describe "#to_human_string" do
    it "returns a translated string" do
      described_class.all.each do |mount_by|
        expect(mount_by.to_human_string).to be_a(String)
      end
    end

    it "returns the internal name (#to_s) for types with no name" do
      allow(described_class::LABEL).to receive(:name).and_return(nil)
      expect(described_class::LABEL.to_human_string).to eq("label")
    end
  end

  describe ".from_fstab_spec" do
    it "returns nil for an empty string" do
      expect(described_class.from_fstab_spec("")).to be_nil
    end

    it "returns nil for a wrong entry" do
      expect(described_class.from_fstab_spec("wrong")).to be_nil
    end

    it "returns UUID for an entry starting with UUID=" do
      expect(described_class.from_fstab_spec("UUID=2f61fdb9-f82a-4052-8610-1eb090b82098"))
        .to eq Y2Storage::Filesystems::MountByType::UUID
    end

    it "returns LABEL for an entry starting with LABEL=" do
      expect(described_class.from_fstab_spec("LABEL=root"))
        .to eq Y2Storage::Filesystems::MountByType::LABEL
    end

    it "returns ID for udev ids" do
      expect(described_class.from_fstab_spec("/dev/disk/by-id/dm-name-system-swap"))
        .to eq Y2Storage::Filesystems::MountByType::ID
    end

    it "returns UUID for udev UUIDs" do
      expect(described_class.from_fstab_spec("/dev/disk/by-uuid/2f61fdb9-f82a"))
        .to eq Y2Storage::Filesystems::MountByType::UUID
    end

    it "returns PATH for udev paths" do
      expect(described_class.from_fstab_spec("/dev/disk/by-path/pci-0000:00:1f.2-ata-1"))
        .to eq Y2Storage::Filesystems::MountByType::PATH
    end

    it "returns DEVICE for kernel device names" do
      expect(described_class.from_fstab_spec("/dev/sda"))
        .to eq Y2Storage::Filesystems::MountByType::DEVICE
    end
  end
end
