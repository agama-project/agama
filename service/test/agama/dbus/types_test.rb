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
require "agama/dbus/types"

describe Agama::DBus::Types::Checker do
  describe "#match?" do
    describe "for Bool type" do
      subject { described_class.new(Agama::DBus::Types::BOOL) }

      it "returns true if the given value is true or false" do
        expect(subject.match?(true)).to eq(true)
        expect(subject.match?(false)).to eq(true)
      end

      it "returns false otherwise" do
        expect(subject.match?(nil)).to eq(false)
        expect(subject.match?("foo")).to eq(false)
        expect(subject.match?(10)).to eq(false)
        expect(subject.match?([])).to eq(false)
        expect(subject.match?({})).to eq(false)
      end
    end

    describe "for Array type" do
      subject { described_class.new(array_type) }

      let(:array_type) { Agama::DBus::Types::Array.new }

      it "returns true if the given value is an array" do
        expect(subject.match?([])).to eq(true)
        expect(subject.match?([1, 2])).to eq(true)
      end

      it "returns false otherwise" do
        expect(subject.match?(nil)).to eq(false)
        expect(subject.match?("foo")).to eq(false)
        expect(subject.match?(10)).to eq(false)
        expect(subject.match?(true)).to eq(false)
        expect(subject.match?({})).to eq(false)
      end

      context "if the elements of the array have to be of a specific type" do
        let(:array_type) { Agama::DBus::Types::Array.new(String) }

        it "returns true if all the elements match the given type" do
          expect(subject.match?([])).to eq(true)
          expect(subject.match?(["foo", "bar"])).to eq(true)
        end

        it "returns false otherwise" do
          expect(subject.match?([nil])).to eq(false)
          expect(subject.match?([10])).to eq(false)
          expect(subject.match?([true])).to eq(false)
          expect(subject.match?([[]])).to eq(false)
          expect(subject.match?([{}])).to eq(false)
        end
      end
    end

    describe "for Hash type" do
      subject { described_class.new(hash_type) }

      let(:hash_type) { Agama::DBus::Types::Hash.new }

      it "returns true if the given value is an hash" do
        expect(subject.match?({})).to eq(true)
        expect(subject.match?({ foo: "", bar: 1 })).to eq(true)
      end

      it "returns false otherwise" do
        expect(subject.match?(nil)).to eq(false)
        expect(subject.match?("foo")).to eq(false)
        expect(subject.match?(10)).to eq(false)
        expect(subject.match?(true)).to eq(false)
        expect(subject.match?([])).to eq(false)
      end

      context "if the keys of the hash have to be of a specific type" do
        let(:hash_type) { Agama::DBus::Types::Hash.new(key: String) }

        it "returns true if all the keys match the given type" do
          expect(subject.match?({})).to eq(true)
          expect(subject.match?({ "foo" => "", "bar" => 1 })).to eq(true)
        end

        it "returns false otherwise" do
          expect(subject.match?({ nil: 1 })).to eq(false)
          expect(subject.match?({ a: 1 })).to eq(false)
          expect(subject.match?({ 10 => 1 })).to eq(false)
          expect(subject.match?({ true => 1 })).to eq(false)
          expect(subject.match?({ [] => 1 })).to eq(false)
          expect(subject.match?({ {} => 1 })).to eq(false)
        end
      end

      context "if the values of the hash have to be of a specific type" do
        let(:hash_type) { Agama::DBus::Types::Hash.new(value: Integer) }

        it "returns true if all the values match the given type" do
          expect(subject.match?({})).to eq(true)
          expect(subject.match?({ "foo" => 1, bar: 2 })).to eq(true)
        end

        it "returns false otherwise" do
          expect(subject.match?({ foo: nil })).to eq(false)
          expect(subject.match?({ foo: 1.0 })).to eq(false)
          expect(subject.match?({ foo: "" })).to eq(false)
          expect(subject.match?({ foo: [] })).to eq(false)
          expect(subject.match?({ foo: {} })).to eq(false)
        end
      end

      context "if the keys and the values of the hash have to be of a specific type" do
        let(:hash_type) do
          Agama::DBus::Types::Hash.new(key: String, value: Agama::DBus::Types::BOOL)
        end

        it "returns true if all the keys and values match the given types" do
          expect(subject.match?({})).to eq(true)
          expect(subject.match?({ "foo" => true, "bar" => false })).to eq(true)
        end

        it "returns false otherwise" do
          expect(subject.match?({ "foo" => nil })).to eq(false)
          expect(subject.match?({ foo: true })).to eq(false)
        end
      end
    end

    describe "for other types" do
      subject { described_class.new(Array) }

      it "returns true if the given value is an instance of the given type" do
        expect(subject.match?([])).to eq(true)
        expect(subject.match?([1, 2])).to eq(true)
      end

      it "returns false otherwise" do
        expect(subject.match?(nil)).to eq(false)
        expect(subject.match?("foo")).to eq(false)
        expect(subject.match?(10)).to eq(false)
        expect(subject.match?(true)).to eq(false)
        expect(subject.match?({})).to eq(false)
      end
    end
  end
end
