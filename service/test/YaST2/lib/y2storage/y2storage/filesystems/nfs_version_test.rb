#!/usr/bin/env rspec
# frozen_string_literal: true

# Copyright (c) [2022] SUSE LLC
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
require "y2storage/filesystems/nfs_version"

describe Y2Storage::Filesystems::NfsVersion do
  include_context "yast2-storage-ng test setup"

  describe ".all" do
    it "returns a list of NfsVersion objects" do
      all = described_class.all

      expect(all).to be_a(Array)
      expect(all).to all(be_a(described_class))
    end

    it "returns a list containing version Any" do
      expect(described_class.all).to include(an_object_having_attributes(value: "any"))
    end

    it "returns a list containing NFSv3" do
      expect(described_class.all).to include(an_object_having_attributes(value: "3"))
    end

    it "returns a list containing NFSv4" do
      expect(described_class.all).to include(an_object_having_attributes(value: "4"))
    end

    it "returns a list containing NFSv4.1" do
      expect(described_class.all).to include(an_object_having_attributes(value: "4.1"))
    end

    it "returns a list containing NFSv4.2" do
      expect(described_class.all).to include(an_object_having_attributes(value: "4.2"))
    end

    it "returns a list without any other version" do
      expect(described_class.all.size).to eq(5)
    end
  end

  describe ".find_by_value" do
    it "returns any version when 'any' is given" do
      version = described_class.find_by_value("any")

      expect(version).to be_a(described_class)
      expect(version.value).to eq("any")
    end

    it "returns NFSv3 when '3' is given" do
      version = described_class.find_by_value("3")

      expect(version).to be_a(described_class)
      expect(version.value).to eq("3")
    end

    it "returns NFSv4 when '4' is given" do
      version = described_class.find_by_value("4")

      expect(version).to be_a(described_class)
      expect(version.value).to eq("4")
    end

    it "returns NFSv4.1 when '4.1' is given" do
      version = described_class.find_by_value("4.1")

      expect(version).to be_a(described_class)
      expect(version.value).to eq("4.1")
    end

    it "returns NFSv4.2 when '4.2' is given" do
      version = described_class.find_by_value("4.2")

      expect(version).to be_a(described_class)
      expect(version.value).to eq("4.2")
    end

    it "returns nil when other value is given" do
      version = described_class.find_by_value("5")

      expect(version).to be_nil
    end
  end

  describe "#name" do
    it "returns 'Any' for any version" do
      expect(described_class.find_by_value("any").name).to eq("Any")
    end

    it "returns 'NFSv3' for version 3" do
      expect(described_class.find_by_value("3").name).to eq("NFSv3")
    end

    it "returns 'NFSv4' for version 4" do
      expect(described_class.find_by_value("4").name).to eq("NFSv4")
    end

    it "returns 'NFSv4.1' for version 4.1" do
      expect(described_class.find_by_value("4.1").name).to eq("NFSv4.1")
    end

    it "returns 'NFSv4.2' for version 4.2" do
      expect(described_class.find_by_value("4.2").name).to eq("NFSv4.2")
    end
  end

  describe "#any?" do
    it "returns true for any version" do
      expect(described_class.find_by_value("any").any?).to eq(true)
    end

    it "returns false for other version" do
      expect(described_class.find_by_value("3").any?).to eq(false)
      expect(described_class.find_by_value("4").any?).to eq(false)
      expect(described_class.find_by_value("4.1").any?).to eq(false)
      expect(described_class.find_by_value("4.2").any?).to eq(false)
    end
  end

  describe "#need_v4_support?" do
    it "returns true for NFSv4" do
      expect(described_class.find_by_value("4").need_v4_support?).to eq(true)
    end

    it "returns true for NFSv4.1" do
      expect(described_class.find_by_value("4.1").need_v4_support?).to eq(true)
    end

    it "returns true for NFSv4.2" do
      expect(described_class.find_by_value("4.2").need_v4_support?).to eq(true)
    end

    it "returns false for other version" do
      expect(described_class.find_by_value("3").need_v4_support?).to eq(false)
      expect(described_class.find_by_value("3").need_v4_support?).to eq(false)
    end
  end

  describe "#==" do
    it "returns true for versions with the same value" do
      v1 = described_class.find_by_value("3")
      v2 = described_class.find_by_value("3")

      expect(v1 == v2).to eq(true)
    end

    it "returns false for versions with different values" do
      v1 = described_class.find_by_value("3")
      v2 = described_class.find_by_value("4")

      expect(v1 == v2).to eq(false)
    end
  end
end
