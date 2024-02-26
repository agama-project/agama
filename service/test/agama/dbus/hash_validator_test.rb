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
require "agama/dbus/hash_validator"
require "agama/dbus/types"

describe Agama::DBus::HashValidator do
  subject { described_class.new(value, scheme: scheme) }

  let(:scheme) do
    {
      "Name"     => String,
      "Surname"  => Agama::DBus::Types::Array.new(String),
      "Age"      => Integer,
      "Height"   => Integer,
      "Children" => Array
    }
  end

  describe "#valid?" do
    context "if there is any key with unexpected type" do
      let(:value) do
        {
          "Gender" => "Male",
          "Height" => true
        }
      end

      it "returns false" do
        expect(subject.valid?).to eq(false)
      end
    end
  end

  describe "#valid?" do
    context "if there is no key with unexpected type" do
      let(:value) do
        {
          "Name"   => "John",
          "Gender" => "Male",
          "Height" => 175
        }
      end

      it "returns true" do
        expect(subject.valid?).to eq(true)
      end
    end
  end

  describe "#valid_keys" do
    let(:value) do
      {
        "Name"     => "John",
        "Gender"   => "Male",
        "Age"      => 45,
        "Height"   => true,
        "Children" => ["Mark", "Zara"]
      }
    end

    it "returns the hash keys defined in the scheme and with the type indicated in the scheme" do
      expect(subject.valid_keys).to eq(["Name", "Age", "Children"])
    end
  end

  describe "#wrong_type_keys" do
    context "if the hash contains the same types as the scheme" do
      let(:value) do
        {
          "Name"     => "John",
          "Age"      => 45,
          "Children" => ["Mark", "Zara"]
        }
      end

      it "returns an empty list" do
        expect(subject.wrong_type_keys).to eq([])
      end
    end

    context "if the hash contains types different to the scheme" do
      let(:value) do
        {
          "Name"     => true,
          "Age"      => 45,
          "Children" => "none"
        }
      end

      it "returns the keys with wrong type" do
        expect(subject.wrong_type_keys).to eq(["Name", "Children"])
      end
    end
  end

  describe "#extra_keys" do
    context "if the hash does not contain keys that are not included in the scheme" do
      let(:value) do
        {
          "Name"     => "Jhon",
          "Children" => []
        }
      end

      it "returns an empty list" do
        expect(subject.extra_keys).to eq([])
      end
    end

    context "if the hash contains some keys that are not included in the scheme" do
      let(:value) do
        {
          "Name"     => "Jhon",
          "Gender"   => "Male",
          "Birthday" => nil,
          "Children" => []
        }
      end

      it "returns a list with the extra keys" do
        expect(subject.extra_keys).to eq(["Gender", "Birthday"])
      end
    end
  end

  describe "#missing_keys" do
    context "if the hash contains all the keys defined in the scheme" do
      let(:value) do
        {
          "Name"     => "Jhon",
          "Surname"  => [],
          "Age"      => 45,
          "Height"   => 176,
          "Children" => []
        }
      end

      it "returns an empty list" do
        expect(subject.missing_keys).to eq([])
      end
    end

    context "if the hash does not contain any of the keys defined in the scheme" do
      let(:value) do
        {
          "Surname" => [],
          "Age"     => 45,
          "Height"  => 176
        }
      end

      it "returns a list with the missing keys" do
        expect(subject.missing_keys).to eq(["Name", "Children"])
      end
    end
  end

  describe "#issues" do
    let(:value) do
      {
        "Name"     => "John",
        "Age"      => 45,
        "Gender"   => "Male",
        "Birthday" => nil,
        "Height"   => "175",
        "Children" => {}
      }
    end

    it "generates an issue for each extra key and for each wrong type" do
      expect(subject.issues).to contain_exactly(
        /Unknown .* Gender/,
        /Unknown .* Birthday/,
        /Height must be/,
        /Children must be/
      )
    end
  end
end
