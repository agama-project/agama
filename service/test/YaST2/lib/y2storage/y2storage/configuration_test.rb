#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2019] SUSE LLC
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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"

require "y2storage"

describe Y2Storage::Configuration do
  include_context "yast2-storage-ng test setup"

  before { Y2Storage::StorageManager.create_test_instance }

  let(:storage) { Y2Storage::StorageManager.instance.storage }
  subject(:configuration) { described_class.new(storage) }

  describe "#default_mount_by" do
    it "returns a MountByType value" do
      expect(configuration.default_mount_by).to be_a(Y2Storage::Filesystems::MountByType)
    end
  end

  describe "#default_mount_by=" do
    before do
      allow(Yast::SCR).to receive(:Read) do |path|
        expect(path.to_s).to match(/DEVICE_NAMES/)
      end.and_return("uuid")
    end

    it "updates the default mount_by value" do
      mount_by_id = Y2Storage::Filesystems::MountByType::ID

      expect(configuration.default_mount_by).to_not eq(mount_by_id)
      configuration.default_mount_by = mount_by_id
      expect(configuration.default_mount_by).to eq(mount_by_id)
    end
  end

  describe "#update_sysconfig" do
    before do
      allow(Yast::SCR).to receive(:Write)
    end

    it "stores current default mount_by into sysconfig file" do
      mount_by_label = Y2Storage::Filesystems::MountByType::LABEL
      configuration.default_mount_by = mount_by_label

      expect(Yast::SCR).to receive(:Write) do |path, value|
        expect(path.to_s).to match(/storage/)
        expect(value).to eq("label")
      end

      configuration.update_sysconfig
    end
  end
end
