#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2017-2026] SUSE LLC
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

require "y2storage/storage_feature"
require "y2storage/storage_features_list"

describe Y2Storage::StorageFeaturesList do
  include_context "yast2-storage-ng test setup"

  describe ".new" do
    let(:features) do
      [Y2Storage::StorageFeature.new(:UF_BTRFS, []), Y2Storage::StorageFeature.new(:UF_EXT2, [])]
    end

    it "returns an empty list when called with no arguments" do
      expect(described_class.new).to be_empty
    end

    it "returns a list of features when called with several features" do
      expect(described_class.new(*features)).to contain_exactly(*features)
    end

    it "returns a list of features when called with an array of features" do
      expect(described_class.new(features)).to contain_exactly(*features)
    end
  end

  describe ".from_bitfield" do
    context "if the bit-field is zero" do
      it "returns an empty list" do
        expect(described_class.from_bitfield(0)).to be_empty
      end
    end

    context "with a non-zero bit-field" do
      it "returns the corresponding list of features" do
        bits = Storage::UF_BTRFS | Storage::UF_LVM
        list = described_class.from_bitfield(bits)
        expect(list).to all be_a(Y2Storage::StorageFeature)
        expect(list.map(&:id)).to contain_exactly(:UF_BTRFS, :UF_LVM)

        bits = Storage::UF_EXT2
        list = described_class.from_bitfield(bits)
        expect(list.size).to eq 1
        feature = list.first
        expect(feature).to be_a Y2Storage::StorageFeature
        expect(feature.to_sym).to eq :UF_EXT2
      end
    end
  end

  describe "#pkg_list" do
    subject(:list) { described_class.from_bitfield(bits) }

    context "if several features require the same package" do
      let(:bits) do
        Storage::UF_EXT2 | Storage::UF_LUKS | Storage::UF_EXT3 | Storage::UF_PLAIN_ENCRYPTION
      end

      it "includes the package only once (no duplicates)" do
        expect(list.pkg_list.sort).to eq ["cryptsetup", "device-mapper", "e2fsprogs"]
      end
    end

    context "if some packages are optional" do
      let(:bits) { Storage::UF_NTFS | Storage::UF_EXT3 }

      before do
        Y2Storage::StorageFeature.drop_cache
        allow(Yast::Package).to receive(:Available).and_return false
        allow(Yast::Package).to receive(:Available).with("ntfsprogs").and_return true
      end

      it "includes the non-optional packages even if they are not available" do
        expect(list.pkg_list).to include "e2fsprogs"
      end

      it "includes the optional packages that are available" do
        expect(list.pkg_list).to include "ntfsprogs"
      end

      it "does not include the optional packages that are not available" do
        expect(list.pkg_list).to_not include "ntfs-3g"
      end
    end

    context "for a list created with a zero bit-field" do
      let(:bits) { 0 }

      it "returns an empty array" do
        expect(list.pkg_list).to eq []
      end
    end

    context "when the list includes both storage and YaST features" do
      let(:bits) { Storage::UF_LUKS }

      before do
        # Not really needed yet since we have no optional packages in any YaST feature
        Y2Storage::YastFeature.drop_cache

        list.concat(Y2Storage::YastFeature.all)
      end

      it "includes the packages related to both kind of features" do
        expect(list.pkg_list).to include("device-mapper", "cryptsetup", "fde-tools")
      end
    end
  end

  describe "#packages" do
    subject(:list) { described_class.from_bitfield(bits) }

    context "if several features require the same package" do
      let(:bits) do
        Storage::UF_EXT2 | Storage::UF_LUKS | Storage::UF_EXT3 | Storage::UF_PLAIN_ENCRYPTION
      end

      it "returns an array of Feature::Package objects" do
        expect(list.packages).to all(be_a(Y2Storage::Feature::Package))
      end

      it "includes the package only once (no duplicates)" do
        package_names = list.packages.map(&:name).sort
        expect(package_names).to eq ["cryptsetup", "device-mapper", "e2fsprogs"]
      end
    end

    context "if some packages are optional" do
      let(:bits) { Storage::UF_NTFS | Storage::UF_EXT3 }

      before do
        Y2Storage::StorageFeature.drop_cache
        allow(Yast::Package).to receive(:Available).and_return false
        allow(Yast::Package).to receive(:Available).with("ntfsprogs").and_return true
      end

      it "returns Feature::Package objects with correct optional flag" do
        packages = list.packages
        e2fsprogs = packages.find { |p| p.name == "e2fsprogs" }
        ntfsprogs = packages.find { |p| p.name == "ntfsprogs" }

        expect(e2fsprogs.optional?).to be false
        expect(ntfsprogs.optional?).to be true
      end

      it "includes the non-optional packages even if they are not available" do
        package_names = list.packages.map(&:name)
        expect(package_names).to include "e2fsprogs"
      end

      it "includes the optional packages that are available" do
        package_names = list.packages.map(&:name)
        expect(package_names).to include "ntfsprogs"
      end

      it "does not include the optional packages that are not available" do
        package_names = list.packages.map(&:name)
        expect(package_names).to_not include "ntfs-3g"
      end
    end

    context "for a list created with a zero bit-field" do
      let(:bits) { 0 }

      it "returns an empty array" do
        expect(list.packages).to eq []
      end
    end

    context "when the list includes both storage and YaST features" do
      let(:bits) { Storage::UF_LUKS }

      before do
        Y2Storage::YastFeature.drop_cache

        list.concat(Y2Storage::YastFeature.all)
      end

      it "returns Feature::Package objects from both kinds of features" do
        expect(list.packages).to all(be_a(Y2Storage::Feature::Package))
      end

      it "includes the packages related to both kind of features" do
        package_names = list.packages.map(&:name)
        expect(package_names).to include("device-mapper", "cryptsetup", "fde-tools")
      end
    end
  end
end
