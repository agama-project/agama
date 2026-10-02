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

require_relative "../../../../test_helper"
require_relative "../support/shared_setup"
require "yast"
require "y2storage"
require "y2storage/sysconfig_storage"

describe Y2Storage::SysconfigStorage do
  include_context "yast2-storage-ng test setup"

  before do
    Y2Storage::StorageManager.create_test_instance

    allow(Yast::SCR).to receive(:Read) { |p| expect(p.to_s).to match(/storage.DEVICE_NAMES/) }
      .and_return(value)

    allow(Yast::SCR).to receive(:Write)
  end

  let(:value) { nil }

  subject { described_class.instance }

  describe "#default_mount_by" do
    it "returns a MountByType object" do
      expect(subject.default_mount_by).to be_a(Y2Storage::Filesystems::MountByType)
    end

    context "when there is a value for DEVICE_NAMES at sysconfig storage file" do
      context "and the value is a valid mount_by value" do
        let(:value) { "path" }

        it "returns the corresponding MountByType object" do
          expect(subject.default_mount_by.is?(:path)).to eq(true)
        end
      end

      context "and the value is not a valid mount_by value" do
        let(:value) { "foo" }

        it "returns the default uuid MountByType object" do
          expect(subject.default_mount_by.is?(:uuid)).to eq(true)
        end
      end
    end

    context "when there is no value for DEVICE_NAMES at sysconfig storage file" do
      let(:value) { nil }

      it "returns the default uuid MountByType object" do
        expect(subject.default_mount_by.is?(:uuid)).to eq(true)
      end
    end
  end

  describe "#default_mount_by=" do
    it "stores the corresponding value for DEVICE_NAMES at sysconfig storage file" do
      expect(Yast::SCR).to receive(:Write) do |path, value|
        expect(path.to_s).to match(/DEVICE_NAMES/)
        expect(value).to eq("id")
      end

      subject.default_mount_by = Y2Storage::Filesystems::MountByType::ID
    end
  end

  describe "#device_names" do
    context "when there is no value for DEVICE_NAMES at sysconfig storage file" do
      let(:value) { nil }

      it "returns nil" do
        expect(subject.device_names).to be_nil
      end
    end

    context "when there is a value for DEVICE_NAMES at sysconfig storage file" do
      let(:value) { "foo" }

      it "gives the value for the DEVICE_NAMES" do
        expect(subject.device_names).to eq("foo")
      end
    end
  end

  describe "#device_names=" do
    it "stores the value for the DEVICE_NAMES at sysconfig storage file" do
      expect(Yast::SCR).to receive(:Write) do |path, value|
        expect(path.to_s).to match(/DEVICE_NAMES/)
        expect(value).to eq("id")
      end

      subject.device_names = "id"
    end
  end
end
