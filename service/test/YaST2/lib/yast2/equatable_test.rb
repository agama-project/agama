#!/usr/bin/env rspec

# Copyright (c) [2021] SUSE LLC
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

require_relative "../test_helper"
require "yast2/equatable"

describe Yast2::Equatable do
  describe ".eql_attrs" do
    class EquatableTest1
      include Yast2::Equatable
    end

    context "when no attributes have been added for comparison" do
      it "returns an empty list" do
        expect(EquatableTest1.eql_attrs).to be_empty
      end
    end

    context "when some attributes have been added for comparison" do
      before do
        EquatableTest1.eql_attr :foo, :bar
      end

      it "returns a list with the name of the attributes for comparison" do
        expect(EquatableTest1.eql_attrs).to contain_exactly(:foo, :bar)
      end
    end
  end

  describe "#eql?" do
    class EquatableTest
      include Yast2::Equatable

      attr_reader :attr1, :attr2, :attr3

      eql_attr :attr1, :attr2

      def initialize(attr1, attr2, attr3)
        @attr1 = attr1
        @attr2 = attr2
        @attr3 = attr3
      end
    end

    subject { EquatableTest.new("a", 10, :foo) }

    context "when giving the same object" do
      let(:other) { subject }

      it "returns true" do
        expect(subject.eql?(other)).to eq(true)
      end
    end

    context "when giving an object of the same class" do
      context "and the attributes for comparison are equal" do
        let(:other) { EquatableTest.new("a", 10, :other) }

        it "returns true" do
          expect(subject.eql?(other)).to eq(true)
        end
      end

      context "and any of the attributes for comparison is not equal" do
        let(:other) { EquatableTest.new("b", 10, :other) }

        it "returns false" do
          expect(subject.eql?(other)).to eq(false)
        end
      end
    end

    context "when giving an object of another class" do
      let(:other) { "Another class" }

      it "returns false" do
        expect(subject.eql?(other)).to eq(false)
      end
    end

    context "with a subclass object" do
      class EquatableTestDerived < EquatableTest; end

      subject { EquatableTestDerived.new("a", 10, :foo) }

      context "when comparing with a parent class object" do
        let(:other) { EquatableTest.new("a", 10, :foo) }

        it "returns false" do
          expect(subject.eql?(other)).to eq(false)
        end
      end

      context "when adding more attributes for comparison" do
        class EquatableTestDerived
          eql_attr :attr3
        end

        context "and any of the parent attributes for comparison is not equal" do
          let(:other) { EquatableTestDerived.new("a", 11, :foo) }

          it "returns false" do
            expect(subject.eql?(other)).to eq(false)
          end
        end

        context "and the parent attributes for comparison are equal" do
          let(:other) { EquatableTestDerived.new("a", 10, attr3) }

          context "but the new attributes for comparison are not equal" do
            let(:attr3) { :bar }

            it "returns false" do
              expect(subject.eql?(other)).to eq(false)
            end
          end

          context "and the new attributes for comparison are equal" do
            let(:attr3) { :foo }

            it "returns true" do
              expect(subject.eql?(other)).to eq(true)
            end
          end
        end
      end
    end
  end

  describe "#eql_hash" do
    class EquatableTest
      include Yast2::Equatable

      attr_reader :attr1, :attr2, :attr3

      eql_attr :attr1, :attr2

      def initialize(attr1, attr2, attr3)
        @attr1 = attr1
        @attr2 = attr2
        @attr3 = attr3
      end
    end

    subject { EquatableTest.new("a", 10, :foo) }

    it "returns a Hash containing the :class key and the object class as the value" do
      expect(subject.eql_hash).to include(class: subject.class)
    end

    it "returns a Hash with the comparing attributes and their values" do
      expect(subject.eql_hash).to include(attr1: "a", attr2: 10)
    end
  end
end
