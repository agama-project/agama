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

require_relative "../../../test_helper"
require "y2s390"

shared_examples "config base collection" do
  subject { described_class.new(elements) }

  let(:elements) { [element1, element2, element3] }

  let(:element1) { element_class.new("test1") }

  let(:element2) { element_class.new("test2") }

  let(:element3) { element_class.new("test3") }

  let(:element_class) { Y2S390::Dasd }

  describe "#add" do
    let(:element) { element_class.new("test") }

    it "adds the given element to the collection" do
      expect(subject.any? { |e| e.id == element.id }).to eq(false)

      size = subject.size
      subject.add(element)

      expect(subject.size).to eq(size + 1)
      expect(subject.any? { |e| e.id == element.id }).to eq(true)
    end

    it "returns the collection" do
      expect(subject.add(element)).to eq(subject)
    end
  end

  describe "#delete" do
    context "if the collection includes an element with the given id" do
      let(:id) { elements.first.id }

      it "deletes the element from the collection" do
        expect(subject.any? { |e| e.id == id }).to eq(true)

        size = subject.size
        subject.delete(id)

        expect(subject.size).to eq(size - 1)
        expect(subject.any? { |e| e.id == id }).to eq(false)
      end

      it "returns the collection" do
        expect(subject.delete(id)).to eq(subject)
      end
    end

    context "if the collection does not include an element with the given id" do
      let(:id) { element_class.new("test").id }

      it "does not modify the collection" do
        size = subject.size
        subject.delete(id)

        expect(subject.size).to eq(size)
      end

      it "returns the collection" do
        expect(subject.delete(id)).to eq(subject)
      end
    end
  end

  describe "#all" do
    it "returns the list of elements" do
      all = subject.all

      expect(all).to eq(elements)
    end
  end

  describe "#by_id" do
    context "if the collection contains an element with the given id" do
      let(:id) { element2.id }

      it "returns the element" do
        result = subject.by_id(id)

        expect(result).to be_a(element_class)
        expect(result.id).to eq(element2.id)
      end
    end

    context "if the collection does not contain an element with the given id" do
      let(:id) { element_class.new("test").id }

      it "returns nil" do
        expect(subject.by_id(id)).to be_nil
      end
    end
  end

  describe "#ids" do
    it "returns the ids of all the elements" do
      ids = elements.map(&:id)

      expect(subject.ids).to contain_exactly(*ids)
    end
  end
end
